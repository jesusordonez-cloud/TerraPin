package mx.org.fraac.geocampo

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.DownloadForOffline
import androidx.compose.material.icons.filled.Hd
import androidx.compose.material.icons.filled.SatelliteAlt
import androidx.compose.material.icons.filled.TravelExplore
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ImageryProviderDialog(
    currentMode: BaseMapMode,
    openAerialMapImagery: OpenAerialMapImagery?,
    onDismiss: () -> Unit,
    onUseSentinel: () -> Unit,
    onUseInegi: () -> Unit,
    onUseOpenAerialMap: () -> Unit,
    onDownloadSentinel: () -> Unit,
    onDownloadInegi: () -> Unit,
    onDownloadOpenAerialMap: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Cerrar") }
        },
        title = { Text("Proveedor de imagen") },
        text = {
            Column(
                modifier = Modifier.heightIn(max = 650.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (openAerialMapImagery != null) {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor =
                                if (currentMode == BaseMapMode.OPENAERIALMAP) {
                                    MaterialTheme.colorScheme.primaryContainer
                                } else {
                                    MaterialTheme.colorScheme.surfaceVariant
                                }
                        )
                    ) {
                        Column(Modifier.padding(12.dp)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Default.TravelExplore, null)
                                Column {
                                    Text(
                                        "OpenAerialMap HD disponible",
                                        style = MaterialTheme.typography.titleSmall
                                    )
                                    Text(
                                        openAerialMapImagery.resolutionLabel +
                                            (openAerialMapImagery.date?.let {
                                                " · " + it.take(10)
                                            } ?: ""),
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }

                            Spacer(Modifier.height(8.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = onUseOpenAerialMap,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.Hd, null)
                                    Spacer(Modifier.width(6.dp))
                                    Text("Usar")
                                }

                                OutlinedButton(
                                    onClick = onDownloadOpenAerialMap,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.DownloadForOffline, null)
                                    Spacer(Modifier.width(6.dp))
                                    Text("Descargar")
                                }
                            }

                            openAerialMapImagery.provider?.let {
                                Text(
                                    "Proveedor: " + it,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                } else {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Column(Modifier.padding(12.dp)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Default.TravelExplore, null)
                                Column {
                                    Text(
                                        "OpenAerialMap",
                                        style = MaterialTheme.typography.titleSmall
                                    )
                                    Text(
                                        "No se detectó una imagen aérea abierta en la zona visible. Acerca el mapa o muévete a otra zona para volver a buscar.",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }
                        }
                    }
                }

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
                                    "Fuente oficial y gratuita para México. En zonas con cobertura ofrece ortofotos de mayor detalle que Sentinel‑2.",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }

                        Spacer(Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = onUseInegi,
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Default.Hd, null)
                                Spacer(Modifier.width(6.dp))
                                Text("Usar")
                            }

                            OutlinedButton(
                                onClick = onDownloadInegi,
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Default.DownloadForOffline, null)
                                Spacer(Modifier.width(6.dp))
                                Text("Descargar")
                            }
                        }

                        Spacer(Modifier.height(6.dp))
                        Text(
                            "No requiere API key. La cobertura y la fecha de la ortofoto varían por zona. La descarga offline evita depender del servicio durante el trabajo de campo.",
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
                                    "Cobertura global abierta. Menor resolución, pero estable y adecuada para áreas grandes.",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }

                        Spacer(Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilledTonalButton(
                                onClick = onUseSentinel,
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Default.Cloud, null)
                                Spacer(Modifier.width(6.dp))
                                Text("Usar")
                            }

                            OutlinedButton(
                                onClick = onDownloadSentinel,
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Default.DownloadForOffline, null)
                                Spacer(Modifier.width(6.dp))
                                Text("Descargar")
                            }
                        }
                    }
                }

                Text(
                    "Para campo, descarga la zona antes de salir. TerraPin guarda la imagen como PMTiles raster local y mantiene encima caminos, límites, puntos y recorridos.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    )
}
