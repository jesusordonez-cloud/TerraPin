# TerraPin · estado del proyecto (actualizado 2026-11-10)

Repositorio: https://github.com/jesusordonez-cloud/TerraPin (público; app de Claude para GitHub instalada). Rama `main`.
App web (Capacitor 6, carpeta `www/`): SIG de campo móvil — mapas offline, satélite, rutas GPS, puntos, polígonos, PDF. Autor: Jesús Reynaldo Ordoñez Pech.

## Versiones
- **4.3** (ya en GitHub, commit `1f7748f`): herramienta Área/polígono (ha y m², perímetro), más satélites gratuitos (Esri Clarity, Google, Bing, Esri Wayback por fecha), Sentinel-2 sin nubes con selector de año (2025 por defecto), grosor/relleno por capa, corrección del arrastre en el editor de impresión y textos libres en la lámina.
- **4.4** (PENDIENTE de push; parche `TerraPin-4.4.patch`, aplica sobre `1f7748f`): grabación GPS en segundo plano en la APK (`@capacitor-community/background-geolocation` 1.2.26 + `@capacitor/local-notifications`, `useLegacyBridge: true`, permisos en el workflow), importación de Shape sin red con reproyección propia (UTM cualquier zona y Cónica Conforme de Lambert INEGI; selector de zona si no hay .prj), mensajes claros y zoom a lo importado. Archivos: www/app.js, www/sw.js, package.json, capacitor.config.json, .github/workflows/build-apk.yml, LEEME.md.

## Cómo publicar la 4.4 (sesión con el repo conectado)
```
git am TerraPin-4.4.patch   # o: git apply --3way TerraPin-4.4.patch && git commit
git push origin main
```
Si `git am` falla por conflicto, copiar los archivos del zip `TerraPin-4.4-archivos.zip` encima y hacer commit.

## Pendientes / ideas
- Probar en teléfono real la grabación con pantalla bloqueada (10 min) tras compilar el APK; si se corta, desactivar optimización de batería (Más → Grabación en segundo plano → Abrir ajustes).
- Verificar en campo que cargan las teselas de Google/Bing/Wayback.
- Nota: el push desde sesiones creadas sin el repo seleccionado falla con 403 (la lista de repos se fija al crear la sesión).
