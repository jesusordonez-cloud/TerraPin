package mx.org.fraac.geocampo

import java.util.PriorityQueue
import kotlin.math.roundToLong

data class FieldRoutePlan(
    val destination: GeoCoord,
    val points: List<GeoCoord>,
    val distanceMeters: Double,
    val usesRoadNetwork: Boolean,
    val sourceLayerNames: List<String>,
    val startSnapMeters: Double? = null,
    val endSnapMeters: Double? = null
)

object FieldRoutePlanner {
    private val roadKeywords = listOf(
        "camino", "caminos", "road", "roads", "calle", "calles",
        "brecha", "brechas", "sendero", "senderos", "acceso", "access",
        "vial", "vialidad", "terraceria", "terracería"
    )

    fun plan(
        start: GeoCoord,
        destination: GeoCoord,
        layers: List<MapLayer>
    ): FieldRoutePlan {
        val visibleLineLayers = layers.filter { layer ->
            layer.visible && layer.features.any { it.geometry is GeoGeometry.LineString }
        }

        if (visibleLineLayers.isEmpty()) {
            return direct(start, destination)
        }

        val preferred = visibleLineLayers.filter(::looksLikeRoadLayer)
        val networkLayers = if (preferred.isNotEmpty()) preferred else visibleLineLayers
        val graph = buildGraph(networkLayers)

        if (graph.coords.size < 2) {
            return direct(start, destination)
        }

        val startNode = nearestNode(start, graph.coords)
        val endNode = nearestNode(destination, graph.coords)
        if (startNode == null || endNode == null) {
            return direct(start, destination)
        }

        val pathIds = dijkstra(graph.adjacency, startNode.first, endNode.first)
            ?: return direct(start, destination)

        val networkPath = pathIds.mapNotNull(graph.coords::get)
        if (networkPath.size < 2) {
            return direct(start, destination)
        }

        val route = buildList {
            add(start)
            if (GeoMath.distanceMeters(start, networkPath.first()) > 1.0) {
                add(networkPath.first())
            }
            addAll(networkPath.drop(1))
            if (GeoMath.distanceMeters(networkPath.last(), destination) > 1.0) {
                add(destination)
            }
        }

        return FieldRoutePlan(
            destination = destination,
            points = route,
            distanceMeters = GeoMath.pathDistanceMeters(route),
            usesRoadNetwork = true,
            sourceLayerNames = networkLayers.map { it.name }.distinct(),
            startSnapMeters = startNode.second,
            endSnapMeters = endNode.second
        )
    }

    private fun direct(start: GeoCoord, destination: GeoCoord): FieldRoutePlan {
        val points = listOf(start, destination)
        return FieldRoutePlan(
            destination = destination,
            points = points,
            distanceMeters = GeoMath.pathDistanceMeters(points),
            usesRoadNetwork = false,
            sourceLayerNames = emptyList()
        )
    }

    private fun looksLikeRoadLayer(layer: MapLayer): Boolean {
        val layerText = (layer.name + " " + layer.sourceFile).lowercase()
        if (roadKeywords.any(layerText::contains)) return true

        return layer.features.any { feature ->
            if (feature.geometry !is GeoGeometry.LineString) return@any false
            val text = buildString {
                append(feature.name.orEmpty())
                append(' ')
                feature.properties.forEach { (key, value) ->
                    append(key)
                    append(' ')
                    append(value)
                    append(' ')
                }
            }.lowercase()
            roadKeywords.any(text::contains)
        }
    }

    private data class Graph(
        val coords: Map<Long, GeoCoord>,
        val adjacency: Map<Long, List<Edge>>
    )

    private data class Edge(val to: Long, val meters: Double)
    private data class QueueNode(val id: Long, val distance: Double)

    private fun buildGraph(layers: List<MapLayer>): Graph {
        val coords = LinkedHashMap<Long, GeoCoord>()
        val mutableAdjacency = HashMap<Long, MutableList<Edge>>()

        layers.forEach { layer ->
            layer.features.forEach { feature ->
                val line = feature.geometry as? GeoGeometry.LineString ?: return@forEach
                val points = line.points.filter { it.lat.isFinite() && it.lon.isFinite() }
                if (points.size < 2) return@forEach

                points.zipWithNext().forEach { (a, b) ->
                    val aKey = key(a)
                    val bKey = key(b)
                    if (aKey == bKey) return@forEach

                    coords.putIfAbsent(aKey, a)
                    coords.putIfAbsent(bKey, b)
                    val meters = GeoMath.distanceMeters(a, b)
                    if (meters <= 0.05 || !meters.isFinite()) return@forEach

                    mutableAdjacency.getOrPut(aKey) { mutableListOf() }
                        .add(Edge(bKey, meters))
                    mutableAdjacency.getOrPut(bKey) { mutableListOf() }
                        .add(Edge(aKey, meters))
                }
            }
        }

        return Graph(
            coords = coords,
            adjacency = mutableAdjacency.mapValues { it.value.toList() }
        )
    }

    private fun key(coord: GeoCoord): Long {
        // ~1 m de precisión. Une vértices coincidentes de distintas líneas sin
        // fusionar caminos paralelos cercanos.
        val lat = (coord.lat * 100_000.0).roundToLong()
        val lon = (coord.lon * 100_000.0).roundToLong()
        return (lat shl 32) xor (lon and 0xffffffffL)
    }

    private fun nearestNode(
        target: GeoCoord,
        coords: Map<Long, GeoCoord>
    ): Pair<Long, Double>? {
        var bestId: Long? = null
        var bestDistance = Double.POSITIVE_INFINITY

        coords.forEach { (id, coord) ->
            val distance = GeoMath.distanceMeters(target, coord)
            if (distance < bestDistance) {
                bestDistance = distance
                bestId = id
            }
        }

        return bestId?.let { it to bestDistance }
    }

    private fun dijkstra(
        adjacency: Map<Long, List<Edge>>,
        start: Long,
        end: Long
    ): List<Long>? {
        if (start == end) return listOf(start)

        val distances = HashMap<Long, Double>()
        val previous = HashMap<Long, Long>()
        val queue = PriorityQueue<QueueNode>(compareBy { it.distance })
        distances[start] = 0.0
        queue.add(QueueNode(start, 0.0))

        while (queue.isNotEmpty()) {
            val current = queue.poll()
            if (current.distance != distances[current.id]) continue
            if (current.id == end) break

            adjacency[current.id].orEmpty().forEach { edge ->
                val candidate = current.distance + edge.meters
                if (candidate < distances.getOrDefault(edge.to, Double.POSITIVE_INFINITY)) {
                    distances[edge.to] = candidate
                    previous[edge.to] = current.id
                    queue.add(QueueNode(edge.to, candidate))
                }
            }
        }

        if (!distances.containsKey(end)) return null

        val reversed = mutableListOf<Long>()
        var cursor = end
        reversed += cursor
        while (cursor != start) {
            cursor = previous[cursor] ?: return null
            reversed += cursor
        }
        reversed.reverse()
        return reversed
    }
}
