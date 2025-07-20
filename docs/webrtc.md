# Detalles WebRTC

## Flujo de señalización

1. **Caller** genera `offer` y lo guarda en `/rooms/{id}/offer`.
2. **Callee** lee la `offer`, la establece y publica `answer`.
3. Ambos clientes recolectan y suben ICE candidates a sub-paths `callerCandidates` y `calleeCandidates`.
4. Cada peer hace _polling_ hasta añadir todos los candidatos.

## Canales de datos

- Se crea un único `RTCDataChannel` con label `files` (ver `DATA_CHANNEL_CONFIG`).
- Configuración _unordered_ & _reliable_ para maximizar throughput.

## Protocolo de transferencia

Mensajes de control (JSON string):
| Tipo | Payload | Significado |
|------|---------|-------------|
| `start` | `{ id, name, size, type }` | Inicio de envío de archivo |
| `end` | `{ fileId }` | Fin del archivo |
| `chat` | `string` | Mensaje de texto |
| `download-ack` | `{ fileId }` | Receptor confirmó descarga |
| `peer-name` | `{ name }` | Nombre del usuario remoto |

### Chunking

- Tamaño fijo: **64 KB** (`CHUNK_SIZE`).
- Se espera a `bufferedamountlow` para evitar desbordar el buffer.

### Progress & estados

`FileTransfer.status` enum:
`queued → sending → sent → downloaded-by-peer` (emisor)
`receiving → received → downloaded-by-you` (receptor)

### Límites y tips

- Funciona en LAN y WAN mientras los STUN/TURN de los navegadores lo permitan (no se usa TURN propio).
- Recomendado < 200 MB para experiencia fluida; futura optimización a gran tamaño.
