# Arquitectura

```mermaid
flowchart LR
    subgraph Navegador «Cliente»
        A[Next.js App] -->|RTCDataChannel| B((Peer A))
        C[Next.js App] -->|RTCDataChannel| D((Peer B))
    end
    B -. Signalling .-> E[Firebase]
    D -. Signalling .-> E
```

1. **Next.js 15** sirve la SPA y gestiona la UI/UX.
2. Cada cliente crea un **RTCPeerConnection** y un **RTCDataChannel**.
3. Para establecer la conexión se usa **Firebase** como canal de señalización:
   - `offer`, `answer` y ICE candidates se escriben en la sala (`/rooms/{id}`).
4. Una vez que la conexión está _connected_, todo el tráfico fluye directamente entre navegadores.
5. Vercel hospeda la aplicación; no interviene en el intercambio de datos.

Características adicionales:

- Reconexión ICE automática (`pc.restartIce()` en fallo).
- Polling adaptativo para estado y candidatos (rápido → lento tras conexión).
