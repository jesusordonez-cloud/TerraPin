# TerraPin

Aplicación Android GIS de campo desarrollada por **Reynaldo Ordoñez**, orientada a trabajo forestal, georreferenciación, evidencias fotográficas y operación offline.

## Funciones principales

- GPS en vivo y botón para centrar la posición.
- Recorridos GPS y puntos georreferenciados.
- Varias fotografías y descripción por punto.
- Ficha visual al tocar un punto.
- Proyectos/carpetas de campo.
- Importación KML/KMZ, GPX, GeoJSON y Shapefile.
- Exportación KML, KMZ con evidencias y Shapefile con fotografías.
- Reporte ejecutivo PDF con mapa, logo FRAAC, fecha, elaboró, descripción y simbología.
- Mapas base PMTiles para trabajo sin conexión.
- Descarga de Sentinel-2 para uso satelital offline.

## Proveedores de imagen

### INEGI Ortofoto HD
Proveedor gratuito y oficial para México, sin API key. Se consume mediante el servicio WMS de INEGI. La cobertura y fecha varían por zona; donde existe ortofoto ofrece mayor detalle que Sentinel-2.

### Sentinel-2 Cloudless / EOX
Cobertura global abierta. Se mantiene como respaldo online y como fuente descargable para uso offline.

El mapa vectorial PMTiles puede superponer caminos y límites sobre las imágenes.

## Compatibilidad

El applicationId se conserva como:

`mx.org.fraac.geocampo`

Esto evita romper la compatibilidad con datos locales de versiones anteriores.

## Compilación

GitHub Actions genera el APK debug en:

`app/build/outputs/apk/debug/app-debug.apk`
