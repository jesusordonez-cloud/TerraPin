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

## Novedades 4.0
- Interfaz cristal oscuro/claro con acento dorado.
- Satélite en vivo gratuito (NASA GIBS: VIIRS, NOAA-20, MODIS) con selector de día y descarga offline por fecha; Sentinel-2 sin nubes (10 m); superposición de incendios activos.
- Sin sistema de usuarios: abre directo al mapa.
- Pestaña Offline propia, HUD con escala gráfica, correcciones en la descarga de mapas.

Fuentes satelitales: respeta las condiciones de NASA GIBS y EOX (Sentinel-2 cloudless es CC BY-NC-SA, uso no comercial).
