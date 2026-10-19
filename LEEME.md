# TerraPin 4.0 · Obsidian Glass

Proyecto web (Capacitor) listo para generar el APK.

## Opción A — GitHub Actions (gratis, sin instalar nada)
1. Crea un repositorio en GitHub y sube **todo el contenido de esta carpeta** (incluida la carpeta oculta `.github`).
2. Entra a la pestaña **Actions** → "Compilar APK de TerraPin" → **Run workflow** (o simplemente haz push a `main`).
3. Al terminar (≈5 min), descarga el artefacto **TerraPin-4.0-debug** → dentro viene `app-debug.apk`.
4. Pásalo al teléfono e instálalo (activa "instalar apps desconocidas").

## Opción B — Android Studio en tu PC
```
npm install
npx cap add android        # solo la primera vez
npx cap sync android
npx cap open android       # Build → Build APK(s)
```
Agrega en `android/app/src/main/AndroidManifest.xml` los permisos
`ACCESS_FINE_LOCATION` y `ACCESS_COARSE_LOCATION` (el workflow lo hace solo).

## Opción C — Sobre tu proyecto Capacitor actual
Reemplaza tu carpeta `www` por la de aquí y ejecuta `npx cap sync android`.

## Novedades 4.2
- **HLS Sentinel / Landsat a 30 m** (NASA, sin cuenta): carreteras, parcelas y ríos; la app busca los días con pase sobre tu zona (“Pases recientes”).
- **Sentinel-2 a 10 m** (cuenta gratuita Copernicus): filtro de nubes máximo, ventana de días, prioridad “menos nubes / más reciente” y lista de pases reales con su % de nubes. Configuración en Más → Sentinel-2 (ver GUIA-COPERNICUS.md).
- Descargas offline de HLS y Sentinel-2 con su fecha/configuración.

## Novedades 4.1
- GOES-East en vivo: imagen nueva cada 10 min (todo América), con botón “Última”, retrocesos de 1–12 h y actualización automática cada 5 min.
- Sello sobre el mapa con fecha y hora de captura de la imagen satelital (hora local, UTC y antigüedad).
- Interruptor “Sin nubes” (mosaico Sentinel-2 10 m).

## Novedades 4.0
- Interfaz cristal oscuro/claro con acento dorado.
- Satélite en vivo gratuito (NASA GIBS: VIIRS, NOAA-20, MODIS) con selector de día y descarga offline por fecha; Sentinel-2 sin nubes (10 m); superposición de incendios activos.
- Sin sistema de usuarios: abre directo al mapa.
- Pestaña Offline propia, HUD con escala gráfica, correcciones en la descarga de mapas.

Fuentes satelitales: respeta las condiciones de NASA GIBS y EOX (Sentinel-2 cloudless es CC BY-NC-SA, uso no comercial).
