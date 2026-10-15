package mx.org.fraac.geocampo

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import kotlin.math.PI
import kotlin.math.asinh
import kotlin.math.atan
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.tan

enum class OfflineImagerySource(val label: String) {
    SENTINEL("Sentinel-2 Cloudless"),
    INEGI("INEGI Ortofoto HD"),
    OPENAERIALMAP("OpenAerialMap")
}

data class SatelliteRegionRequest(
    val name: String,
    val west: Double,
    val south: Double,
    val east: Double,
    val north: Double,
    val maxZoom: Int,
    val source: OfflineImagerySource = OfflineImagerySource.SENTINEL,
    val tileTemplate: String? = null,
    val sourceDetail: String? = null,
    val directPmtilesUrl: String? = null
)

data class SatelliteDownloadProgress(
    val completed: Int,
    val total: Int,
    val downloadedBytes: Long,
    val stage: String? = null
)

class SatelliteOfflineManager(private val context: Context) {
    private val dir = File(context.filesDir, "satellite_offline").apply { mkdirs() }
    private val prefs = context.getSharedPreferences("offline_imagery_preferences", 0)

    fun load(): PmTilesBasemap? =
        newestPmtiles()?.let { runCatching { PmTilesParser.read(it) }.getOrNull() }

    fun loadSource(): OfflineImagerySource? {
        prefs.getString(KEY_SOURCE, null)?.let { stored ->
            runCatching { OfflineImagerySource.valueOf(stored) }.getOrNull()?.let { return it }
        }

        val name = newestPmtiles()?.name?.lowercase(Locale.ROOT) ?: return null
        return when {
            "_inegi_" in name -> OfflineImagerySource.INEGI
            "_openaerialmap_" in name -> OfflineImagerySource.OPENAERIALMAP
            else -> OfflineImagerySource.SENTINEL
        }
    }

    fun deleteAll() {
        dir.listFiles()?.forEach { it.delete() }
        prefs.edit().remove(KEY_SOURCE).apply()
    }

    suspend fun download(
        request: SatelliteRegionRequest,
        onProgress: (SatelliteDownloadProgress) -> Unit
    ): PmTilesBasemap = withContext(Dispatchers.IO) {
        validate(request)

        val safe = request.name
            .ifBlank { "imagen_offline" }
            .lowercase(Locale.ROOT)
            .replace(Regex("[^a-z0-9áéíóúñ_-]+"), "_")
            .trim('_')
            .ifBlank { "imagen_offline" }

        val stamp = System.currentTimeMillis()
        val target = File(
            dir,
            stamp.toString() + "_" +
                request.source.name.lowercase(Locale.ROOT) + "_" +
                safe + ".pmtiles"
        )

        if (
            request.source == OfflineImagerySource.OPENAERIALMAP &&
            !request.directPmtilesUrl.isNullOrBlank()
        ) {
            onProgress(
                SatelliteDownloadProgress(
                    completed = 0,
                    total = 1000,
                    downloadedBytes = 0L,
                    stage = "Descargando paquete PMTiles de OpenAerialMap…"
                )
            )

            downloadDirectPmtiles(
                url = request.directPmtilesUrl,
                target = target,
                onProgress = onProgress
            )

            val binary = File(context.applicationInfo.nativeLibraryDir, "libpmtiles.so")
            if (binary.exists()) verifyPmtiles(binary, target)

            val parsed = PmTilesParser.read(target)
            require(parsed.isRaster) {
                target.delete()
                "El paquete OpenAerialMap descargado no es una imagen raster compatible."
            }

            replacePreviousOfflineFile(target)
            prefs.edit().putString(KEY_SOURCE, request.source.name).apply()

            onProgress(
                SatelliteDownloadProgress(
                    completed = 1000,
                    total = 1000,
                    downloadedBytes = target.length(),
                    stage = "OpenAerialMap offline listo"
                )
            )
            return@withContext parsed
        }

        val effectiveRequest = preflightRequest(request, onProgress)
        val minZoom = minZoomFor(effectiveRequest.source)
        val tiles = enumerateTiles(effectiveRequest, minZoom)

        require(tiles.isNotEmpty()) {
            "No se encontraron teselas para el área seleccionada."
        }
        require(tiles.size <= MAX_TILE_COUNT) {
            "El área generaría " + tiles.size +
                " teselas. Reduce el área o el nivel de zoom."
        }

        onProgress(
            SatelliteDownloadProgress(
                completed = 0,
                total = tiles.size,
                downloadedBytes = 0L,
                stage = "Preparando " + effectiveRequest.source.label + "…"
            )
        )

        val mbtiles = File(dir, "tmp_" + stamp + ".mbtiles")
        val db = SQLiteDatabase.openOrCreateDatabase(mbtiles, null)
        var tileFormat: String? = null
        var completed = 0
        var bytes = 0L
        var failures = 0
        var successes = 0

        try {
            createMbtilesSchema(db)

            val concurrency = when (effectiveRequest.source) {
                OfflineImagerySource.SENTINEL -> 4
                OfflineImagerySource.INEGI -> 2
                OfflineImagerySource.OPENAERIALMAP -> 3
            }
            val batchSize = when (effectiveRequest.source) {
                OfflineImagerySource.SENTINEL -> 24
                OfflineImagerySource.INEGI -> 6
                OfflineImagerySource.OPENAERIALMAP -> 6
            }
            val semaphore = Semaphore(concurrency)

            for (batch in tiles.chunked(batchSize)) {
                val results = coroutineScope {
                    batch.map { tile ->
                        async(Dispatchers.IO) {
                            semaphore.withPermit {
                                tile to downloadTile(tile, effectiveRequest, attempts = 3)
                            }
                        }
                    }.awaitAll()
                }

                db.beginTransaction()
                try {
                    for ((tile, data) in results) {
                        completed++
                        if (data == null) {
                            failures++
                            continue
                        }

                        val detected = detectImageFormat(data)
                        if (detected == null) {
                            failures++
                            continue
                        }

                        if (tileFormat == null) tileFormat = detected
                        bytes += data.size
                        successes++
                        insertTile(db, tile, data)
                    }
                    db.setTransactionSuccessful()
                } finally {
                    db.endTransaction()
                }

                onProgress(
                    SatelliteDownloadProgress(
                        completed = completed,
                        total = tiles.size,
                        downloadedBytes = bytes,
                        stage = "Descargando " + effectiveRequest.source.label +
                            " · " + completed + " de " + tiles.size
                    )
                )
            }

            require(successes > 0 && tileFormat != null) {
                when (effectiveRequest.source) {
                    OfflineImagerySource.INEGI ->
                        "INEGI no devolvió imágenes válidas para esta zona. " +
                            "Puede no existir cobertura de ortofoto o el servicio puede estar temporalmente ocupado."
                    OfflineImagerySource.OPENAERIALMAP ->
                        "OpenAerialMap no devolvió imágenes válidas dentro del área seleccionada. " +
                            "Acerca el mapa y vuelve a intentar."
                    OfflineImagerySource.SENTINEL ->
                        "No se recibieron imágenes satelitales válidas."
                }
            }

            val allowedFailures = when (effectiveRequest.source) {
                OfflineImagerySource.OPENAERIALMAP -> max(12, tiles.size * 2 / 3)
                OfflineImagerySource.INEGI -> max(20, tiles.size / 3)
                OfflineImagerySource.SENTINEL -> max(12, tiles.size / 8)
            }

            require(failures <= allowedFailures) {
                "Fallaron demasiadas teselas (" + failures + " de " + tiles.size +
                    "). Reduce el área, baja el zoom o inténtalo nuevamente."
            }

            insertMetadata(
                db = db,
                request = effectiveRequest,
                minZoom = minZoom,
                format = tileFormat ?: "jpg"
            )

            db.execSQL(
                "CREATE UNIQUE INDEX IF NOT EXISTS tile_index ON tiles(zoom_level, tile_column, tile_row)"
            )
        } finally {
            db.close()
        }

        val binary = File(context.applicationInfo.nativeLibraryDir, "libpmtiles.so")
        require(binary.exists()) {
            mbtiles.delete()
            "No se encontró el convertidor PMTiles en este dispositivo."
        }

        onProgress(
            SatelliteDownloadProgress(
                completed = tiles.size,
                total = tiles.size,
                downloadedBytes = bytes,
                stage = "Empaquetando mapa offline…"
            )
        )

        convertMbtiles(binary, mbtiles, target)
        mbtiles.delete()

        require(target.exists() && target.length() > 127L) {
            target.delete()
            "La conversión terminó sin producir un PMTiles válido."
        }

        verifyPmtiles(binary, target)

        val parsed = PmTilesParser.read(target)
        require(parsed.isRaster) {
            target.delete()
            "El archivo descargado no fue reconocido como imagen raster."
        }

        replacePreviousOfflineFile(target)
        prefs.edit().putString(KEY_SOURCE, effectiveRequest.source.name).apply()
        parsed
    }

    fun estimateTileCount(request: SatelliteRegionRequest): Int =
        runCatching {
            validate(request)
            if (
                request.source == OfflineImagerySource.OPENAERIALMAP &&
                !request.directPmtilesUrl.isNullOrBlank()
            ) {
                1
            } else {
                enumerateTiles(request, minZoomFor(request.source)).size
            }
        }.getOrDefault(0)

    private suspend fun preflightRequest(
        request: SatelliteRegionRequest,
        onProgress: (SatelliteDownloadProgress) -> Unit
    ): SatelliteRegionRequest {
        if (request.source == OfflineImagerySource.SENTINEL) return request

        onProgress(
            SatelliteDownloadProgress(
                completed = 0,
                total = 1,
                downloadedBytes = 0L,
                stage = "Validando cobertura de " + request.source.label + "…"
            )
        )

        val minZoom = minZoomFor(request.source)
        val centerLon = (request.west + request.east) / 2.0
        val centerLat = (request.south + request.north) / 2.0

        for (zoom in request.maxZoom downTo minZoom) {
            val tile = Tile(
                z = zoom,
                x = lonToTileX(centerLon, zoom),
                y = latToTileY(centerLat, zoom)
            )

            val data = downloadTile(tile, request, attempts = 2)
            if (data != null && detectImageFormat(data) != null) {
                return request.copy(maxZoom = zoom)
            }
        }

        error(
            when (request.source) {
                OfflineImagerySource.OPENAERIALMAP ->
                    "La imagen aparece en el catálogo, pero el servidor no entregó una tesela válida " +
                        "para el centro del área. Acerca el mapa a la cobertura visible e inténtalo de nuevo."
                OfflineImagerySource.INEGI ->
                    "INEGI no entregó una ortofoto válida para el centro del área. " +
                        "Prueba con otra zona o vuelve a intentarlo más tarde."
                OfflineImagerySource.SENTINEL ->
                    "No se pudo validar la fuente satelital."
            }
        )
    }

    private fun downloadDirectPmtiles(
        url: String,
        target: File,
        onProgress: (SatelliteDownloadProgress) -> Unit
    ) {
        val temp = File(target.parentFile, target.name + ".part")
        temp.delete()

        try {
            val connection = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 15_000
                readTimeout = 45_000
                instanceFollowRedirects = true
                setRequestProperty("User-Agent", "TerraPin-Android/0.5.7")
                setRequestProperty("Accept", "application/octet-stream,*/*")
            }

            try {
                val code = connection.responseCode
                require(code in 200..299) {
                    "OpenAerialMap respondió HTTP " + code + " al descargar PMTiles."
                }

                val expected = connection.contentLengthLong.takeIf { it > 0L }
                var downloaded = 0L
                var chunks = 0

                connection.inputStream.use { input ->
                    FileOutputStream(temp).use { output ->
                        val buffer = ByteArray(128 * 1024)
                        while (true) {
                            val read = input.read(buffer)
                            if (read <= 0) break
                            output.write(buffer, 0, read)
                            downloaded += read
                            chunks++

                            if (chunks % 4 == 0) {
                                val completed =
                                    if (expected != null) {
                                        ((downloaded.toDouble() / expected.toDouble()) * 1000.0)
                                            .toInt()
                                            .coerceIn(0, 999)
                                    } else {
                                        (chunks * 8).coerceAtMost(950)
                                    }

                                onProgress(
                                    SatelliteDownloadProgress(
                                        completed = completed,
                                        total = 1000,
                                        downloadedBytes = downloaded,
                                        stage = "Descargando PMTiles de OpenAerialMap…"
                                    )
                                )
                            }
                        }
                    }
                }
            } finally {
                connection.disconnect()
            }

            require(temp.length() > 127L) {
                "OpenAerialMap devolvió un paquete PMTiles vacío o incompleto."
            }

            if (!temp.renameTo(target)) {
                temp.copyTo(target, overwrite = true)
                temp.delete()
            }
        } catch (error: Exception) {
            temp.delete()
            target.delete()
            throw error
        }
    }

    private fun replacePreviousOfflineFile(target: File) {
        dir.listFiles()
            ?.filter {
                it.isFile &&
                    it.extension.equals("pmtiles", true) &&
                    it.absolutePath != target.absolutePath
            }
            ?.forEach { it.delete() }
    }

    private fun newestPmtiles(): File? =
        dir.listFiles()
            ?.filter { it.isFile && it.extension.equals("pmtiles", true) }
            ?.maxByOrNull { it.lastModified() }

    private fun validate(request: SatelliteRegionRequest) {
        require(request.west in -180.0..180.0) { "Longitud oeste inválida" }
        require(request.east in -180.0..180.0) { "Longitud este inválida" }
        require(request.south in -85.0..85.0) { "Latitud sur inválida" }
        require(request.north in -85.0..85.0) { "Latitud norte inválida" }
        require(request.west < request.east) { "El oeste debe ser menor que el este" }
        require(request.south < request.north) { "El sur debe ser menor que el norte" }

        when (request.source) {
            OfflineImagerySource.SENTINEL ->
                require(request.maxZoom in 8..14) {
                    "Sentinel-2 admite zoom de descarga entre 8 y 14"
                }
            OfflineImagerySource.INEGI ->
                require(request.maxZoom in 10..18) {
                    "INEGI admite zoom de descarga entre 10 y 18"
                }
            OfflineImagerySource.OPENAERIALMAP -> {
                require(request.maxZoom in 14..20) {
                    "OpenAerialMap admite zoom de descarga entre 14 y 20"
                }
                require(
                    !request.tileTemplate.isNullOrBlank() ||
                        !request.directPmtilesUrl.isNullOrBlank()
                ) {
                    "No hay una imagen OpenAerialMap activa para descargar."
                }
            }
        }

        require(request.east - request.west <= 10.0 && request.north - request.south <= 10.0) {
            "El área seleccionada es demasiado grande."
        }
    }

    private data class Tile(val z: Int, val x: Int, val y: Int)

    private fun minZoomFor(source: OfflineImagerySource): Int =
        when (source) {
            OfflineImagerySource.SENTINEL -> 0
            OfflineImagerySource.INEGI -> 10
            OfflineImagerySource.OPENAERIALMAP -> 14
        }

    private fun enumerateTiles(
        request: SatelliteRegionRequest,
        minZoom: Int
    ): List<Tile> {
        val result = ArrayList<Tile>()
        for (z in minZoom..request.maxZoom) {
            val westX = lonToTileX(request.west, z)
            val eastX = lonToTileX(request.east, z)
            val northY = latToTileY(request.north, z)
            val southY = latToTileY(request.south, z)

            val xMin = min(westX, eastX)
            val xMax = max(westX, eastX)
            val yMin = min(northY, southY)
            val yMax = max(northY, southY)

            for (x in xMin..xMax) {
                for (y in yMin..yMax) {
                    result += Tile(z, x, y)
                    if (result.size > MAX_TILE_COUNT) return result
                }
            }
        }
        return result
    }

    private fun lonToTileX(lon: Double, z: Int): Int {
        val n = 1 shl z
        return floor((lon + 180.0) / 360.0 * n)
            .toInt()
            .coerceIn(0, n - 1)
    }

    private fun latToTileY(lat: Double, z: Int): Int {
        val n = 1 shl z
        val clamped = lat.coerceIn(-85.05112878, 85.05112878)
        val rad = Math.toRadians(clamped)
        val y = (1.0 - asinh(tan(rad)) / PI) / 2.0 * n
        return floor(y).toInt().coerceIn(0, n - 1)
    }

    private fun tileXToLon(x: Int, z: Int): Double {
        val n = (1 shl z).toDouble()
        return x / n * 360.0 - 180.0
    }

    private fun tileYToLat(y: Int, z: Int): Double {
        val n = (1 shl z).toDouble()
        val mercator = PI * (1.0 - 2.0 * y / n)
        return Math.toDegrees(atan(0.5 * (exp(mercator) - exp(-mercator))))
    }

    private fun createMbtilesSchema(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE metadata (name TEXT, value TEXT)")
        db.execSQL(
            """CREATE TABLE tiles(
                zoom_level INTEGER,
                tile_column INTEGER,
                tile_row INTEGER,
                tile_data BLOB
            )""".trimIndent()
        )
    }

    private fun insertMetadata(
        db: SQLiteDatabase,
        request: SatelliteRegionRequest,
        minZoom: Int,
        format: String
    ) {
        val centerLon = (request.west + request.east) / 2.0
        val centerLat = (request.south + request.north) / 2.0
        val description = when (request.source) {
            OfflineImagerySource.SENTINEL ->
                "TerraPin Sentinel-2 Cloudless offline"
            OfflineImagerySource.INEGI ->
                "TerraPin INEGI Ortofoto HD offline"
            OfflineImagerySource.OPENAERIALMAP ->
                "TerraPin OpenAerialMap offline" +
                    (request.sourceDetail?.let { " · " + it } ?: "")
        }
        val attribution = when (request.source) {
            OfflineImagerySource.SENTINEL -> ATTRIBUTION
            OfflineImagerySource.INEGI ->
                "INEGI · Ortofotos · https://www.inegi.org.mx/"
            OfflineImagerySource.OPENAERIALMAP ->
                "OpenAerialMap / HOT" +
                    (request.sourceDetail?.let { " · " + it } ?: "")
        }

        val values = linkedMapOf(
            "name" to request.name,
            "type" to "baselayer",
            "version" to "1.0",
            "description" to description,
            "format" to format,
            "bounds" to String.format(
                Locale.US,
                "%.7f,%.7f,%.7f,%.7f",
                request.west,
                request.south,
                request.east,
                request.north
            ),
            "center" to String.format(
                Locale.US,
                "%.7f,%.7f,%d",
                centerLon,
                centerLat,
                min(request.maxZoom, 17)
            ),
            "minzoom" to minZoom.toString(),
            "maxzoom" to request.maxZoom.toString(),
            "attribution" to attribution
        )

        values.forEach { (key, value) ->
            db.insertOrThrow(
                "metadata",
                null,
                ContentValues().apply {
                    put("name", key)
                    put("value", value)
                }
            )
        }
    }

    private fun insertTile(db: SQLiteDatabase, tile: Tile, data: ByteArray) {
        val tmsRow = (1 shl tile.z) - 1 - tile.y
        db.insertOrThrow(
            "tiles",
            null,
            ContentValues().apply {
                put("zoom_level", tile.z)
                put("tile_column", tile.x)
                put("tile_row", tmsRow)
                put("tile_data", data)
            }
        )
    }

    private fun downloadTile(
        tile: Tile,
        request: SatelliteRegionRequest,
        attempts: Int
    ): ByteArray? {
        val url = when (request.source) {
            OfflineImagerySource.SENTINEL -> sentinelTileUrl(tile)
            OfflineImagerySource.INEGI -> inegiTileUrl(tile)
            OfflineImagerySource.OPENAERIALMAP -> openAerialMapTileUrl(tile, request)
        }

        repeat(attempts) { attempt ->
            try {
                val connection = (URL(url).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 10_000
                    readTimeout = 20_000
                    instanceFollowRedirects = true
                    setRequestProperty("User-Agent", "TerraPin-Android/0.5.7")
                    setRequestProperty("Accept", "image/jpeg,image/png,image/webp,image/*")
                    setRequestProperty("Cache-Control", "no-cache")
                }

                try {
                    val code = connection.responseCode
                    if (code == 404 || code == 204) return null

                    if (code == 429 || code >= 500) {
                        if (attempt < attempts - 1) Thread.sleep(500L * (attempt + 1))
                        return@repeat
                    }

                    if (code !in 200..299) {
                        if (attempt < attempts - 1) Thread.sleep(350L * (attempt + 1))
                        return@repeat
                    }

                    val data = connection.inputStream.use { it.readBytes() }
                    if (data.isEmpty() || detectImageFormat(data) == null) {
                        if (attempt < attempts - 1) Thread.sleep(300L * (attempt + 1))
                        return@repeat
                    }
                    return data
                } finally {
                    connection.disconnect()
                }
            } catch (_: Exception) {
                if (attempt < attempts - 1) {
                    Thread.sleep(450L * (attempt + 1))
                }
            }
        }

        return null
    }

    private fun sentinelTileUrl(tile: Tile): String =
        "https://tiles.maps.eox.at/wmts/1.0.0/" +
            "s2cloudless-2025_3857/default/g/" +
            tile.z + "/" + tile.y + "/" + tile.x + ".jpg"

    private fun inegiTileUrl(tile: Tile): String {
        val west = tileXToLon(tile.x, tile.z)
        val east = tileXToLon(tile.x + 1, tile.z)
        val north = tileYToLat(tile.y, tile.z)
        val south = tileYToLat(tile.y + 1, tile.z)
        val bbox = String.format(
            Locale.US,
            "%.8f,%.8f,%.8f,%.8f",
            west,
            south,
            east,
            north
        )

        return "https://gaia.inegi.org.mx/NLB/tunnel/wms/wms61?" +
            "SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap" +
            "&LAYERS=Ortofotos&STYLES=" +
            "&SRS=EPSG:4326" +
            "&BBOX=" + bbox +
            "&WIDTH=256&HEIGHT=256" +
            "&FORMAT=image/jpeg&TRANSPARENT=FALSE"
    }

    private fun openAerialMapTileUrl(
        tile: Tile,
        request: SatelliteRegionRequest
    ): String {
        val template = request.tileTemplate
            ?: error("No hay plantilla de teselas OpenAerialMap")
        return template
            .replace("{z}", tile.z.toString())
            .replace("{x}", tile.x.toString())
            .replace("{y}", tile.y.toString())
    }

    private fun detectImageFormat(data: ByteArray): String? {
        if (
            data.size >= 3 &&
            data[0] == 0xFF.toByte() &&
            data[1] == 0xD8.toByte() &&
            data[2] == 0xFF.toByte()
        ) return "jpg"

        if (
            data.size >= 8 &&
            data[0] == 0x89.toByte() &&
            data[1] == 0x50.toByte() &&
            data[2] == 0x4E.toByte() &&
            data[3] == 0x47.toByte()
        ) return "png"

        if (
            data.size >= 12 &&
            data[0] == 'R'.code.toByte() &&
            data[1] == 'I'.code.toByte() &&
            data[2] == 'F'.code.toByte() &&
            data[3] == 'F'.code.toByte() &&
            data[8] == 'W'.code.toByte() &&
            data[9] == 'E'.code.toByte() &&
            data[10] == 'B'.code.toByte() &&
            data[11] == 'P'.code.toByte()
        ) return "webp"

        return null
    }

    private fun convertMbtiles(binary: File, mbtiles: File, target: File) {
        val process = ProcessBuilder(
            binary.absolutePath,
            "convert",
            mbtiles.absolutePath,
            target.absolutePath
        )
            .redirectErrorStream(true)
            .start()

        val output = process.inputStream.bufferedReader().use { it.readText() }
        val exit = process.waitFor()

        if (exit != 0) {
            target.delete()
            error(
                "No se pudo crear el archivo offline. " +
                    output.lineSequence()
                        .filter { it.isNotBlank() }
                        .toList()
                        .takeLast(8)
                        .joinToString(" ")
            )
        }
    }

    private fun verifyPmtiles(binary: File, target: File) {
        val process = ProcessBuilder(
            binary.absolutePath,
            "verify",
            target.absolutePath
        )
            .redirectErrorStream(true)
            .start()

        val output = process.inputStream.bufferedReader().use { it.readText() }
        val exit = process.waitFor()

        if (exit != 0) {
            target.delete()
            error(
                "El archivo offline se generó, pero no pasó la verificación PMTiles. " +
                    output.lineSequence()
                        .filter { it.isNotBlank() }
                        .toList()
                        .takeLast(6)
                        .joinToString(" ")
            )
        }
    }

    companion object {
        const val ATTRIBUTION =
            "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH " +
                "(Contains modified Copernicus Sentinel data 2025)"

        private const val MAX_TILE_COUNT = 9_000
        private const val KEY_SOURCE = "offline_imagery_source"
    }
}
