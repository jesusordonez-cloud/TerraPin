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

## Satélite reciente / casi en vivo

TerraPin 0.5.9 incorpora una capa satelital opcional que se superpone al mapa sin sustituir las capas de campo:

- **GOES GeoColor (NOAA/NESDIS):** imagen de cobertura amplia con actualización aproximada cada 10–15 minutos. Requiere conexión a internet.
- **VIIRS NOAA-21 (NASA GIBS):** imagen reciente de mayor detalle relativo, con actualización diaria.
- La capa puede activarse, ocultarse y ajustar su opacidad desde el selector de imágenes.
- Los caminos, límites, puntos, recorridos y rutas de TerraPin permanecen visibles sobre la imagen.
- No se presenta como video en tiempo real; la aplicación consulta la imagen más reciente disponible del proveedor.
- La función se integra como overlay independiente y conserva visibles las capas operativas de TerraPin.

## Compatibilidad

El applicationId se conserva como:

`mx.org.fraac.geocampo`

Esto evita romper la compatibilidad con datos locales de versiones anteriores.

## Compilación

GitHub Actions genera el APK debug en:

`app/build/outputs/apk/debug/app-debug.apk`


### OpenAerialMap
TerraPin consulta automáticamente la API STAC moderna de OpenAerialMap para el área visible del mapa. Cuando existe cobertura, muestra un aviso con la resolución disponible y permite activar la mejor imagen aérea encontrada. OpenAerialMap utiliza imágenes abiertas de drones, aeronaves y otros proveedores, por lo que la cobertura varía por zona.


## Identidad visual

El ícono de TerraPin utiliza el pin ecológico con paisaje de selva, río, hojas y ruta georreferenciada definido para la aplicación.
