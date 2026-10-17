# TerraPin 2.0 — rama de prueba Capacitor

Esta rama mantiene **TerraPin 2.0 (PWA + Capacitor)** separada de la aplicación Android nativa que permanece en `main`.

## Fuente usada

La compilación utiliza exactamente el paquete **TerraPin-2.0.zip** proporcionado para esta versión. Para conservar el ZIP binario sin modificarlo, su Base64 está almacenado en cuatro partes dentro de `source/`. GitHub Actions las reconstruye antes de compilar.

SHA-256 esperado del ZIP:

`bb08e350e82860fd4df38bc76e07442e952b20e1261680b7790a8d47942d52da`

El ZIP contiene la PWA completa: `index.html`, `app.js`, `sw.js`, `manifest.json`, iconos, `package.json`, configuración de Capacitor y documentación.

## Compilación

El workflow `.github/workflows/build-terrapin-2.yml`:

1. reconstruye y verifica el ZIP;
2. descomprime TerraPin 2.0;
3. valida JavaScript y JSON;
4. instala Capacitor;
5. genera y sincroniza el proyecto Android;
6. agrega permisos de ubicación y `WAKE_LOCK`;
7. usa el icono TerraPin incluido en el paquete como icono del APK;
8. compila `app-debug.apk`;
9. publica el artefacto **TerraPin-2.0-apk**.

La rama `main` no se modifica con este proceso.
