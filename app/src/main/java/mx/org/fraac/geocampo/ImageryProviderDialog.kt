package mx.org.fraac.geocampo

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Hd
import androidx.compose.material.icons.filled.SatelliteAlt
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ImageryProviderDialog(
    currentMode: BaseMapMode,
    onDismiss: () -> Unit,
    onUseSentinel: () -> Unit,
    onUseInegi: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Cerrar") }
        },
        title = { Text("Proveedor de imagen") },
        text = {
            Column(
                modifier = Modifier.heightIn(max = 560.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor =
                            if (currentMode == BaseMapMode.INEGI_ORTHO) {
                                MaterialTheme.colorScheme.primaryContainer
                            } else {
                                MaterialTheme.colorScheme.surfaceVariant
                            }
                    )
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.Hd, null)
                            Column {
                                Text(
                                    "INEGI Ortofoto HD",
                                    style = MaterialTheme.typography.titleSmall
                                )
                                Text(
                                    "Fuente oficial y gratuita para México. En las zonas con cobertura ofrece ortofotos de mayor detalle que Sentinel‑2.",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Button(onClick = onUseInegi) {
                            Icon(Icons.Default.Hd, null)
                            Spacer(Modifier.width(6.dp))
                            Text("Usar INEGI HD")
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "No requiere API key. Requiere internet y la cobertura/fecha de la ortofoto varía por zona.",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Card(
                    colors = CardDefaults.cardColors(
                        containerColor =
                            if (currentMode == BaseMapMode.SATELLITE_ONLINE) {
                                MaterialTheme.colorScheme.primaryContainer
                            } else {
                                MaterialTheme.colorScheme.surfaceVariant
                            }
                    )
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.SatelliteAlt, null)
                            Column {
                                Text(
                                    "Sentinel‑2 Cloudless",
                                    style = MaterialTheme.typography.titleSmall
                                )
                                Text(
                                    "Cobertura global abierta. Menor resolución, pero estable y disponible también para descarga offline.",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        FilledTonalButton(onClick = onUseSentinel) {
                            Icon(Icons.Default.Cloud, null)
                            Spacer(Modifier.width(6.dp))
                            Text("Usar Sentinel‑2")
                        }
                    }
                }

                Text(
                    "TerraPin mantiene el mapa vectorial PMTiles para calles, caminos y límites sobre las imágenes.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    )
}
