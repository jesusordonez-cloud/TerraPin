# Guía: cuenta gratuita Copernicus para Sentinel-2 (10 m) en TerraPin

1. Entra a **https://dataspace.copernicus.eu** → **Register**. Confirma el correo.
2. Abre **https://shapps.dataspace.copernicus.eu/dashboard** e inicia sesión.
3. Menú izquierdo → **Configuration Utility** → **New configuration**.
4. Name: `TerraPin`. En *Create configuration based on* elige **Simple Sentinel-2 L2A** → **Create configuration**.
5. Copia el **Id** (código largo con guiones, p. ej. `3f1c…-…`).
6. En TerraPin: **Más → Sentinel-2 → Configurar**, pega el Id y pulsa **Probar y guardar**.
   La app prueba automáticamente los nombres de capa habituales (`1_TRUE_COLOR`, `TRUE_COLOR`…). Si no conecta, abre tu configuración en el dashboard, mira el nombre exacto de la capa de color real y escríbelo en el campo “Capa”.

## Uso
- Botón **Satélite en vivo** → **Sentinel-2 10 m**: elige nubes máximas (10–70 %), ventana (10–60 días) y prioridad (menos nubes / más reciente).
- Abajo aparecen los **pases reales** sobre tu zona con su % de nubes; toca uno para ver exactamente ese día.
- **Guardar esta vista offline** descarga esa configuración para usarla sin señal.

## Límites
- Resolución 10 m: calles principales, lotes, edificios como bloques (zoom 13–15). No se ven coches ni techos individuales; eso solo existe en imágenes comerciales.
- La cuota gratuita es mensual y amplia para uso personal; descarga solo el área que necesites.
- El Id se guarda únicamente en tu teléfono.
