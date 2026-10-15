package mx.org.fraac.geocampo

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.DownloadForOffline
import androidx.compose.material.icons.filled.Hd
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.OfflinePin
import androidx.compose.material.icons.filled.SatelliteAlt
import androidx.compose.material.icons.filled.TravelExplore
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.util.Locale
import kotlin.math.PI
import kotlin.math.asinh
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.tan

@Composable
fun SatelliteOfflineDialog(
    satellite: PmTilesBasemap?,
    activeSource: OfflineImagerySource?,
    initialSource: OfflineImagerySource,
    openAerialMapImagery: OpenAerialMapImagery?,
    visibleViewport: MapViewport?,
    currentFix: TrackPoint?,
    busy: Boolean,
    progress: Float,
    status: String?,
    downloadedBytes: Long,
    onDismiss: () -> Unit,
    onRequestFix: () -> Unit,
    onDownload: (SatelliteRegionRequest) -> Unit,
    onDelete: () -> Unit,
    onUseOffline: () -> Unit
) {
    var source by remember(initialSource) { mutableStateOf(initialSource) }
    var maxZoom by remember(initialSource) {
        mutableIntStateOf(defaultZoom(initialSource))
    }
    var radiusKm by remember(initialSource) {
        mutableIntStateOf(defaultRadius(initialSource))
    }

    LaunchedEffect(source) {
        if (maxZoom !in zoomOptions(source)) {
            maxZoom = defaultZoom(source)
        }
        if (radiusKm !in radiusOptions(source)) {
            radiusKm = defaultRadius(source)
        }
    }

    val sourceDetail = remember(openAerialMapImagery) {
        openAerialMapImagery?.let {
            buildString {
                append(it.provider ?: it.title)
                append(" · ")
                append(it.resolutionLabel)
                it.date?.take(10)?.let { date ->
                    append(" · ")
                    append(date)
                }
            }
        }
    }

    fun buildRequest(
        name: String,
        west: Double,
        south: Double,
        east: Double,
        north: Double
    ): SatelliteRegionRequest? {
        val clipped =
            if (source == OfflineImagerySource.OPENAERIALMAP) {
                clipToOamCoverage(
                    west = west,
                    south = south,
                    east = east,
                    north = north,
                    imagery = openAerialMapImagery
                ) ?: return null
            } else {
                DownloadBox(west, south, east, north)
            }

        return SatelliteRegionRequest(
            name = name,
            west = clipped.west,
            south = clipped.south,
            east = clipped.east,
            north = clipped.north,
            maxZoom = maxZoom,
            source = source,
            tileTemplate =
                if (source == OfflineImagerySource.OPENAERIALMAP) {
                    openAerialMapImagery?.tileTemplate
                } else {
                    null
                },
            sourceDetail =
                if (source == OfflineImagerySource.OPENAERIALMAP) {
                    sourceDetail
                } else {
                    null
                }
        )
    }

    val visibleRequest = remember(
        visibleViewport,
        source,
        maxZoom,
        openAerialMapImagery,
        sourceDetail
    ) {
        visibleViewport?.let { viewport ->
            if (
                viewport.west < viewport.east &&
                viewport.south < viewport.north &&
                (source != OfflineImagerySource.OPENAERIALMAP ||
                    openAerialMapImagery != null)
            ) {
                buildRequest(
                    name = sourceFilePrefix(source) + "_Area_visible",
                    west = viewport.west,
                    south = viewport.south,
                    east = viewport.east,
                    north = viewport.north
                )
            } else {
                null
            }
        }
    }

    val gpsRequest = remember(
        currentFix,
        radiusKm,
        maxZoom,
        source,
        openAerialMapImagery,
        sourceDetail
    ) {
        currentFix?.let {
            val box = bboxAround(it.lat, it.lon, radiusKm.toDouble())
            if (
                source != OfflineImagerySource.OPENAERIALMAP ||
                openAerialMapImagery != null
            ) {
                buildRequest(
                    name = sourceFilePrefix(source) + "_GPS_" + radiusKm + "km",
                    west = box.west,
                    south = box.south,
                    east = box.east,
                    north = box.north
                )
            } else {
                null
            }
        }
    }

    val directOamRequest = remember(
        source,
        maxZoom,
        openAerialMapImagery,
        sourceDetail
    ) {
        val imagery = openAerialMapImagery
        val url = imagery?.offlinePmtilesUrl
        if (
            source == OfflineImagerySource.OPENAERIALMAP &&
            imagery != null &&
            !url.isNullOrBlank()
        ) {
            val west = imagery.coverageWest
            val south = imagery.coverageSouth
            val east = imagery.coverageEast
            val north = imagery.coverageNorth
            if (west != null && south != null && east != null && north != null) {
                SatelliteRegionRequest(
                    name = "OpenAerialMap_Imagen_completa",
                    west = west,
                    south = south,
                    east = east,
                    north = north,
                    maxZoom = maxZoom,
                    source = OfflineImagerySource.OPENAERIALMAP,
                    tileTemplate = imagery.tileTemplate,
                    sourceDetail = sourceDetail,
                    directPmtilesUrl = url
                )
            } else {
                null
            }
        } else {
            null
        }
    }

    val campecheRequest = remember(maxZoom, source) {
        if (source == OfflineImagerySource.SENTINEL) {
            SatelliteRegionRequest(
                name = "Campeche_Sentinel2_2025",
                west = CAMPECHE_WEST,
                south = CAMPECHE_SOUTH,
                east = CAMPECHE_EAST,
                north = CAMPECHE_NORTH,
                maxZoom = min(maxZoom, 13),
                source = OfflineImagerySource.SENTINEL
            )
        } else {
            null
        }
    }

    val visibleTiles = remember(visibleRequest) {
        visibleRequest?.let(::estimateTiles) ?: 0
    }
    val gpsTiles = remember(gpsRequest) {
        gpsRequest?.let(::estimateTiles) ?: 0
    }
    val campecheTiles = remember(campecheRequest) {
        campecheRequest?.let(::estimateTiles) ?: 0
    }

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        confirmButton = {
            TextButton(onClick = onDismiss, enabled = !busy) {
                Text("Cerrar")
            }
        },
        title = { Text("Imágenes para uso offline") },
        text = {
            LazyColumn(
                modifier = Modifier.heightIn(max = 650.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Text(
                        "Descarga la imagen del proveedor que necesites y úsala después sin datos ni Wi‑Fi.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(
                        "La nueva descarga sustituye a la imagen offline anterior para ahorrar almacenamiento.",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                if (satellite != null) {
                    item {
                        Card {
                            Column(Modifier.padding(12.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(Modifier.weight(1f)) {
                                        Text(
                                            "Imagen offline disponible",
                                            style = MaterialTheme.typography.titleMedium
                                        )
                                        Text(
                                            activeSource?.label ?: satellite.name,
                                            style = MaterialTheme.typography.bodySmall
                                        )
                                        Text(
                                            "Zoom " + satellite.minZoom + "–" + satellite.maxZoom,
                                            style = MaterialTheme.typography.labelSmall
                                        )
                                    }
                                    Icon(
                                        Icons.Default.OfflinePin,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary
                                    )
                                }

                                Spacer(Modifier.height(8.dp))

                                Button(
                                    onClick = onUseOffline,
                                    enabled = !busy
                                ) {
                                    Icon(Icons.Default.OfflinePin, null)
                                    Spacer(Modifier.width(6.dp))
                                    Text("Usar imagen offline")
                                }

                                TextButton(
                                    onClick = onDelete,
                                    enabled = !busy
                                ) {
                                    Icon(Icons.Default.DeleteOutline, null)
                                    Spacer(Modifier.width(6.dp))
                                    Text("Eliminar descarga")
                                }
                            }
                        }
                    }
                }

                if (busy) {
                    item {
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.primaryContainer
                            )
                        ) {
                            Column(
                                Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp)
                            ) {
                                LinearProgressIndicator(
                                    progress = { progress.coerceIn(0f, 1f) },
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    status ?: "Descargando imagen…",
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                Text(
                                    "Descargado: " + formatBytes(downloadedBytes),
                                    style = MaterialTheme.typography.labelSmall
                                )
                                Text(
                                    "Mantén TerraPin abierto hasta terminar.",
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                        }
                    }
                }

                item {
                    Text(
                        "Proveedor",
                        style = MaterialTheme.typography.titleSmall
                    )

                    FilterChip(
                        selected = source == OfflineImagerySource.SENTINEL,
                        onClick = {
                            source = OfflineImagerySource.SENTINEL
                            maxZoom = 13
                            radiusKm = 10
                        },
                        enabled = !busy,
                        leadingIcon = { Icon(Icons.Default.SatelliteAlt, null) },
                        label = { Text("Sentinel‑2 · cobertura global") }
                    )

                    FilterChip(
                        selected = source == OfflineImagerySource.INEGI,
                        onClick = {
                            source = OfflineImagerySource.INEGI
                            maxZoom = 16
                            radiusKm = 5
                        },
                        enabled = !busy,
                        leadingIcon = { Icon(Icons.Default.Hd, null) },
                        label = { Text("INEGI Ortofoto HD · México") }
                    )

                    FilterChip(
                        selected = source == OfflineImagerySource.OPENAERIALMAP,
                        onClick = {
                            source = OfflineImagerySource.OPENAERIALMAP
                            maxZoom = 16
                            radiusKm = 2
                        },
                        enabled = !busy && openAerialMapImagery != null,
                        leadingIcon = { Icon(Icons.Default.TravelExplore, null) },
                        label = {
                            Text(
                                if (openAerialMapImagery != null) {
                                    "OpenAerialMap · cobertura detectada"
                                } else {
                                    "OpenAerialMap · sin cobertura detectada"
                                }
                            )
                        }
                    )

                    if (
                        source == OfflineImagerySource.OPENAERIALMAP &&
                        openAerialMapImagery != null
                    ) {
                        Text(
                            openAerialMapImagery.resolutionLabel +
                                (openAerialMapImagery.provider?.let {
                                    " · " + it
                                } ?: ""),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            if (openAerialMapImagery.hasDirectOfflinePackage) {
                                "✓ Esta imagen ofrece un paquete PMTiles directo para offline."
                            } else {
                                "TerraPin recortará la descarga a la cobertura real de esta imagen."
                            },
                            style = MaterialTheme.typography.labelSmall,
                            color = if (openAerialMapImagery.hasDirectOfflinePackage) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            }
                        )
                    }
                }

                item {
                    Text(
                        "Nivel de detalle",
                        style = MaterialTheme.typography.titleSmall
                    )
                    Text(
                        when (source) {
                            OfflineImagerySource.SENTINEL ->
                                "Z13 es equilibrado. Z14 ofrece el máximo detalle útil de Sentinel‑2."
                            OfflineImagerySource.INEGI ->
                                "Z16 es recomendado. Z17 ofrece más detalle, pero aumenta considerablemente la descarga."
                            OfflineImagerySource.OPENAERIALMAP ->
                                "Z16 es recomendado para imagen aérea. Z17 úsalo en áreas pequeñas."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        zoomOptions(source).forEach { zoom ->
                            FilterChip(
                                selected = maxZoom == zoom,
                                onClick = { maxZoom = zoom },
                                enabled = !busy,
                                label = { Text("Z" + zoom) }
                            )
                        }
                    }
                }

                if (
                    source == OfflineImagerySource.OPENAERIALMAP &&
                    directOamRequest != null
                ) {
                    item {
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.primaryContainer
                            )
                        ) {
                            Column(Modifier.padding(12.dp)) {
                                Text(
                                    "Descarga OAM recomendada",
                                    style = MaterialTheme.typography.titleSmall
                                )
                                Text(
                                    "Esta imagen ya tiene un PMTiles preparado por OpenAerialMap. " +
                                        "Es la opción más estable para uso sin conexión.",
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Spacer(Modifier.height(8.dp))
                                Button(
                                    onClick = { onDownload(directOamRequest) },
                                    enabled = !busy
                                ) {
                                    Icon(Icons.Default.DownloadForOffline, null)
                                    Spacer(Modifier.width(6.dp))
                                    Text("Descargar imagen completa")
                                }
                            }
                        }
                    }
                }

                item {
                    HorizontalDivider()
                    Text(
                        "Área visible en pantalla",
                        style = MaterialTheme.typography.titleSmall
                    )
                    Text(
                        "Recomendado: descarga exactamente la zona que estás viendo en el mapa.",
                        style = MaterialTheme.typography.bodySmall
                    )

                    if (visibleRequest == null) {
                        Text(
                            "Mueve el mapa hasta la zona que necesitas y vuelve a abrir esta opción.",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        Text(
                            "Estimado: " + formatCount(visibleTiles) + " teselas",
                            style = MaterialTheme.typography.labelSmall
                        )
                        Spacer(Modifier.height(6.dp))
                        Button(
                            onClick = { onDownload(visibleRequest) },
                            enabled = !busy && visibleTiles in 1..MAX_RECOMMENDED_TILES
                        ) {
                            Icon(Icons.Default.DownloadForOffline, null)
                            Spacer(Modifier.width(6.dp))
                            Text("Descargar área visible")
                        }

                        if (visibleTiles > MAX_RECOMMENDED_TILES) {
                            Text(
                                "Esta vista es demasiado grande para ese nivel de detalle. Acerca el mapa o baja el zoom de descarga.",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }

                item {
                    HorizontalDivider()
                    Text(
                        "Alrededor de mi ubicación",
                        style = MaterialTheme.typography.titleSmall
                    )
                    Text(
                        "Útil para preparar trabajo de campo alrededor del GPS.",
                        style = MaterialTheme.typography.bodySmall
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        radiusOptions(source).forEach { km ->
                            FilterChip(
                                selected = radiusKm == km,
                                onClick = { radiusKm = km },
                                enabled = !busy,
                                label = { Text(km.toString() + " km") }
                            )
                        }
                    }

                    Spacer(Modifier.height(4.dp))

                    if (currentFix == null) {
                        FilledTonalButton(
                            onClick = onRequestFix,
                            enabled = !busy
                        ) {
                            Icon(Icons.Default.MyLocation, null)
                            Spacer(Modifier.width(6.dp))
                            Text("Obtener mi ubicación")
                        }
                    } else if (gpsRequest != null) {
                        Text(
                            String.format(
                                Locale.US,
                                "Centro: %.5f, %.5f",
                                currentFix.lat,
                                currentFix.lon
                            ),
                            style = MaterialTheme.typography.labelMedium
                        )
                        Text(
                            "Estimado: " + formatCount(gpsTiles) + " teselas",
                            style = MaterialTheme.typography.labelSmall
                        )
                        Spacer(Modifier.height(6.dp))
                        Button(
                            onClick = { onDownload(gpsRequest) },
                            enabled = !busy && gpsTiles in 1..MAX_RECOMMENDED_TILES
                        ) {
                            Icon(Icons.Default.DownloadForOffline, null)
                            Spacer(Modifier.width(6.dp))
                            Text("Descargar zona alrededor del GPS")
                        }

                        if (gpsTiles > MAX_RECOMMENDED_TILES) {
                            Text(
                                "Reduce el radio o el nivel de detalle para evitar una descarga excesiva.",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }

                if (
                    source == OfflineImagerySource.SENTINEL &&
                    campecheRequest != null
                ) {
                    item {
                        HorizontalDivider()
                        Text(
                            "Campeche completo",
                            style = MaterialTheme.typography.titleSmall
                        )
                        Text(
                            "Disponible únicamente con Sentinel‑2 para mantener un tamaño razonable.",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            "Estimado: " + formatCount(campecheTiles) + " teselas",
                            style = MaterialTheme.typography.labelSmall
                        )
                        Spacer(Modifier.height(6.dp))
                        Button(
                            onClick = { onDownload(campecheRequest) },
                            enabled = !busy
                        ) {
                            Icon(Icons.Default.DownloadForOffline, null)
                            Spacer(Modifier.width(6.dp))
                            Text("Descargar Campeche")
                        }
                    }
                }

                item {
                    HorizontalDivider()
                    Text(
                        "Cómo funciona",
                        style = MaterialTheme.typography.titleSmall
                    )
                    Text(
                        "TerraPin descarga las teselas del proveedor y las empaqueta en un PMTiles raster local. Después la imagen se abre desde el almacenamiento del teléfono, por lo que ya no depende de que INEGI u OpenAerialMap respondan en ese momento.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Text(
                        "La cantidad final de MB depende del área, la cobertura y el nivel de zoom.",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    )
}

private data class DownloadBox(
    val west: Double,
    val south: Double,
    val east: Double,
    val north: Double
)

private fun clipToOamCoverage(
    west: Double,
    south: Double,
    east: Double,
    north: Double,
    imagery: OpenAerialMapImagery?
): DownloadBox? {
    val item = imagery ?: return null
    val iw = item.coverageWest ?: return DownloadBox(west, south, east, north)
    val isouth = item.coverageSouth ?: return DownloadBox(west, south, east, north)
    val ie = item.coverageEast ?: return DownloadBox(west, south, east, north)
    val inorth = item.coverageNorth ?: return DownloadBox(west, south, east, north)

    val clippedWest = max(west, iw)
    val clippedSouth = max(south, isouth)
    val clippedEast = min(east, ie)
    val clippedNorth = min(north, inorth)

    if (clippedWest >= clippedEast || clippedSouth >= clippedNorth) return null
    return DownloadBox(clippedWest, clippedSouth, clippedEast, clippedNorth)
}

private data class SatelliteBox(
    val west: Double,
    val south: Double,
    val east: Double,
    val north: Double
)

private fun bboxAround(
    lat: Double,
    lon: Double,
    radiusKm: Double
): SatelliteBox {
    val latDelta = radiusKm / 111.32
    val lonFactor = 111.32 * cos(Math.toRadians(lat)).coerceAtLeast(0.2)
    val lonDelta = radiusKm / lonFactor

    return SatelliteBox(
        west = (lon - lonDelta).coerceAtLeast(-180.0),
        south = (lat - latDelta).coerceAtLeast(-85.0),
        east = (lon + lonDelta).coerceAtMost(180.0),
        north = (lat + latDelta).coerceAtMost(85.0)
    )
}

private fun zoomOptions(source: OfflineImagerySource): List<Int> =
    when (source) {
        OfflineImagerySource.SENTINEL -> listOf(12, 13, 14)
        OfflineImagerySource.INEGI,
        OfflineImagerySource.OPENAERIALMAP -> listOf(14, 16, 17)
    }

private fun radiusOptions(source: OfflineImagerySource): List<Int> =
    when (source) {
        OfflineImagerySource.SENTINEL -> listOf(5, 10, 25, 50)
        OfflineImagerySource.INEGI -> listOf(1, 2, 5, 10)
        OfflineImagerySource.OPENAERIALMAP -> listOf(1, 2, 5, 10)
    }

private fun defaultZoom(source: OfflineImagerySource): Int =
    when (source) {
        OfflineImagerySource.SENTINEL -> 13
        OfflineImagerySource.INEGI,
        OfflineImagerySource.OPENAERIALMAP -> 16
    }

private fun defaultRadius(source: OfflineImagerySource): Int =
    when (source) {
        OfflineImagerySource.SENTINEL -> 10
        OfflineImagerySource.INEGI -> 5
        OfflineImagerySource.OPENAERIALMAP -> 2
    }

private fun sourceFilePrefix(source: OfflineImagerySource): String =
    when (source) {
        OfflineImagerySource.SENTINEL -> "Sentinel2"
        OfflineImagerySource.INEGI -> "INEGI_Ortofoto"
        OfflineImagerySource.OPENAERIALMAP -> "OpenAerialMap"
    }

private fun estimateTiles(request: SatelliteRegionRequest): Int {
    var total = 0L
    val minZoom =
        when (request.source) {
            OfflineImagerySource.SENTINEL -> 0
            OfflineImagerySource.INEGI -> 10
            OfflineImagerySource.OPENAERIALMAP -> 14
        }

    for (z in minZoom..request.maxZoom) {
        val n = 1 shl z
        fun x(lon: Double): Int =
            floor((lon + 180.0) / 360.0 * n)
                .toInt()
                .coerceIn(0, n - 1)

        fun y(lat: Double): Int {
            val rad = Math.toRadians(lat.coerceIn(-85.05112878, 85.05112878))
            return floor((1.0 - asinh(tan(rad)) / PI) / 2.0 * n)
                .toInt()
                .coerceIn(0, n - 1)
        }

        val x1 = x(request.west)
        val x2 = x(request.east)
        val y1 = y(request.north)
        val y2 = y(request.south)

        total +=
            (max(x1, x2) - min(x1, x2) + 1L) *
                (max(y1, y2) - min(y1, y2) + 1L)
    }
    return total.coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
}

private fun formatCount(value: Int): String =
    String.format(Locale.US, "%,d", value)

private fun formatBytes(bytes: Long): String {
    if (bytes <= 0L) return "0 MB"
    val mb = bytes / (1024.0 * 1024.0)
    return if (mb < 1024.0) {
        String.format(Locale.US, "%.1f MB", mb)
    } else {
        String.format(Locale.US, "%.2f GB", mb / 1024.0)
    }
}

private const val MAX_RECOMMENDED_TILES = 9_000
private const val CAMPECHE_WEST = -92.46879
private const val CAMPECHE_SOUTH = 17.812871
private const val CAMPECHE_EAST = -89.121229
private const val CAMPECHE_NORTH = 20.848327
