# TerraPin 2.1 — rama Capacitor

Esta rama mantiene **TerraPin PWA + Capacitor** separada de la aplicación Android/Kotlin que permanece en `main`.

## Novedades 2.1

- Logo ecológico de TerraPin de la versión Android anterior como icono, encabezado y pantalla inicial.
- Selector de 12 iconos para puntos de campo: punto, árbol, bosque, agua, foto, sitio, campamento, vehículo, camino, fauna, alerta y revisado.
- Los iconos elegidos se conservan en los proyectos y en GeoJSON.
- Generación de **PDF por proyecto** y **reporte general**.
- Opción **Imprimir** con diseño ejecutivo.
- Reporte A4 con identidad TerraPin, indicadores, croquis vectorial de rutas/puntos, detalle de recorridos y puntos de campo.
- El motor PDF (jsPDF) queda incluido dentro de la aplicación para poder generar informes sin conexión.

## Compilación

El workflow `.github/workflows/build-terrapin-2.yml` reconstruye la fuente base 2.0, aplica de forma verificable el parche 2.1, recupera el logo desde `main`, genera Android con Capacitor y publica:

- `TerraPin-2.1-apk`
- `TerraPin-2.1-source`

La rama `main` no se modifica.
