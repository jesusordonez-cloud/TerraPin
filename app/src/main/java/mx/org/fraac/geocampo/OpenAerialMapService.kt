package mx.org.fraac.geocampo

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.Locale

data class MapViewport(
    val west: Double,
    val south: Double,
    val east: Double,
    val north: Double,
    val zoom: Double
) {
    val centerLat: Double get() = (south + north) / 2.0
    val centerLon: Double get() = (west + east) / 2.0
    val lonSpan: Double get() = east - west
    val latSpan: Double get() = north - south
}

data class OpenAerialMapImagery(
    val id: String,
    val collection: String,
    val title: String,
    val date: String?,
    val platform: String?,
    val provider: String?,
    val gsdMeters: Double?,
    val license: String?,
    val tileTemplate: String
) {
    val resolutionLabel: String
        get() = when {
            gsdMeters == null -> "Resolución no informada"
            gsdMeters < 0.1 -> "${(gsdMeters * 100.0).toInt().coerceAtLeast(1)} cm/píxel"
            gsdMeters < 1.0 -> String.format(Locale.US, "%.1f cm/píxel", gsdMeters * 100.0)
            else -> String.format(Locale.US, "%.1f m/píxel", gsdMeters)
        }
}

class OpenAerialMapService {
    suspend fun search(viewport: MapViewport): Result<OpenAerialMapImagery?> =
        withContext(Dispatchers.IO) {
            runCatching {
                val features = retry(3) { searchFeatures(viewport) }
                if (features.isEmpty()) return@runCatching null

                val ranked = features
                    .mapNotNull(::parseCandidate)
                    .sortedWith(
                        compareBy<OpenAerialMapCandidate> {
                            it.gsdMeters ?: Double.POSITIVE_INFINITY
                        }.thenByDescending {
                            it.date.orEmpty()
                        }
                    )

                for (candidate in ranked.take(8)) {
                    val tiles = runCatching {
                        retry(3) {
                            fetchTileTemplate(candidate.collection, candidate.id)
                        }
                    }.getOrNull()

                    if (!tiles.isNullOrBlank()) {
                        return@runCatching OpenAerialMapImagery(
                            id = candidate.id,
                            collection = candidate.collection,
                            title = candidate.title,
                            date = candidate.date,
                            platform = candidate.platform,
                            provider = candidate.provider,
                            gsdMeters = candidate.gsdMeters,
                            license = candidate.license,
                            tileTemplate = tiles
                        )
                    }
                }

                null
            }
        }

    private fun searchFeatures(viewport: MapViewport): List<JSONObject> {
        val connection = (URL("$STAC_URL/search").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            connectTimeout = 12_000
            readTimeout = 20_000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "TerraPin-Android/0.5.6")
            setRequestProperty("Accept", "application/geo+json,application/json")
            setRequestProperty("Content-Type", "application/json")
        }

        val body = JSONObject().apply {
            put("limit", 12)
            put(
                "bbox",
                JSONArray().apply {
                    put(viewport.west)
                    put(viewport.south)
                    put(viewport.east)
                    put(viewport.north)
                }
            )
        }

        try {
            OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use {
                it.write(body.toString())
            }

            val code = connection.responseCode
            require(code in 200..299) { "STAC respondió HTTP $code" }

            val json = connection.inputStream.bufferedReader().use { it.readText() }
            val array = JSONObject(json).optJSONArray("features") ?: JSONArray()

            return buildList {
                for (i in 0 until array.length()) {
                    array.optJSONObject(i)?.let(::add)
                }
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun parseCandidate(feature: JSONObject): OpenAerialMapCandidate? {
        val id = feature.optString("id").takeIf { it.isNotBlank() } ?: return null
        val collection = feature.optString("collection").takeIf { it.isNotBlank() } ?: return null
        val props = feature.optJSONObject("properties") ?: JSONObject()

        val gsd = props.optDouble("gsd", Double.NaN)
            .takeIf { it.isFinite() && it > 0.0 }

        return OpenAerialMapCandidate(
            id = id,
            collection = collection,
            title = props.optString("title")
                .takeIf { it.isNotBlank() }
                ?: "Imagen OpenAerialMap",
            date = firstNonBlank(
                props.optString("datetime"),
                props.optString("start_datetime"),
                props.optString("end_datetime")
            ),
            platform = firstNonBlank(
                props.optString("oam:platform_type"),
                props.optString("platform")
            ),
            provider = firstNonBlank(
                props.optString("oam:producer_name"),
                props.optString("provider")
            ),
            gsdMeters = gsd,
            license = props.optString("license").takeIf { it.isNotBlank() }
        )
    }

    private fun fetchTileTemplate(collection: String, id: String): String? {
        val collectionEncoded = pathSegment(collection)
        val idEncoded = pathSegment(id)
        val endpoint =
            "$RASTER_URL/collections/$collectionEncoded/items/$idEncoded/tiles"

        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 12_000
            readTimeout = 20_000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "TerraPin-Android/0.5.6")
            setRequestProperty("Accept", "application/json")
        }

        try {
            val code = connection.responseCode
            require(code in 200..299) { "Tiles OAM respondió HTTP $code" }

            val json = connection.inputStream.bufferedReader().use { it.readText() }
            val tilesets = JSONObject(json).optJSONArray("tilesets") ?: return null

            for (i in 0 until tilesets.length()) {
                val links = tilesets.optJSONObject(i)
                    ?.optJSONArray("links")
                    ?: continue

                for (j in 0 until links.length()) {
                    val link = links.optJSONObject(j) ?: continue
                    if (link.optString("rel") != "tile") continue

                    val href = link.optString("href")
                    if (href.isBlank() || !href.contains("WebMercatorQuad")) continue

                    return normalizeTileTemplate(href)
                }
            }

            return null
        } finally {
            connection.disconnect()
        }
    }

    private fun normalizeTileTemplate(href: String): String {
        val normalized = href
            .replace("{tileMatrix}", "{z}")
            .replace("{tileCol}", "{x}")
            .replace("{tileRow}", "{y}")

        val path = normalized.substringBefore("?")
            .removeSuffix("@1x")
            .removeSuffix("@2x")
        val oldQuery = normalized.substringAfter("?", "")
        val queryParts = mutableListOf<String>()

        if (oldQuery.isNotBlank()) queryParts += oldQuery
        if (queryParts.none { it.contains("assets=") }) queryParts += "assets=visual"

        return path + "@2x?" + queryParts.joinToString("&")
    }

    private fun <T> retry(attempts: Int, block: () -> T): T {
        var lastError: Exception? = null
        repeat(attempts) { index ->
            try {
                return block()
            } catch (error: Exception) {
                lastError = error
                if (index < attempts - 1) {
                    Thread.sleep(500L * (index + 1))
                }
            }
        }
        throw lastError ?: IllegalStateException("No se pudo consultar OpenAerialMap")
    }

    private fun pathSegment(value: String): String =
        URLEncoder.encode(value, StandardCharsets.UTF_8.toString())
            .replace("+", "%20")

    private fun firstNonBlank(vararg values: String): String? =
        values.firstOrNull { it.isNotBlank() }

    private data class OpenAerialMapCandidate(
        val id: String,
        val collection: String,
        val title: String,
        val date: String?,
        val platform: String?,
        val provider: String?,
        val gsdMeters: Double?,
        val license: String?
    )

    companion object {
        private const val STAC_URL = "https://api.imagery.hotosm.org/stac"
        private const val RASTER_URL = "https://api.imagery.hotosm.org/raster"
    }
}
