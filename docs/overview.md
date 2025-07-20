# Webpipe-RTC – Visión general

## Propósito

Aplicación web mínima para transferir archivos y mensajes de texto **peer-to-peer** mediante WebRTC, sin depender de servidores intermedios para los datos. Ideal para compartir información sensible o archivos que no deben comprimirse ni almacenarse en servicios de terceros.

## Público objetivo

Cualquier persona que necesite mover archivos entre dispositivos de forma rápida, segura y sin huella en la nube.

## Flujo de usuario

1. Pantalla inicial: crear sala o unirse a una existente.
2. Unión por: QR, enlace directo o introduciendo ID de sala.
3. Una vez dentro: interfaz tipo chat (mensajes a la derecha, historial de archivos a la izquierda).
4. Arrastrar/soltar archivos o usar botón 📎 para ponerlos en cola y enviarlos.

## Funcionalidades destacadas

- Transferencia de archivos y mensajes sin servidor usando **RTCDataChannel**.
- Sin límites teóricos de tamaño (objetivo futuro >1 GB), actualmente optimizado para archivos pequeños/medios.
- Confirmación de descarga y progreso en tiempo real.
- UI súper ligera con **Chakra UI**.

## Tecnologías clave

| Capa                 | Tecnología              | Descripción                                           |
| -------------------- | ----------------------- | ----------------------------------------------------- |
| Frontend             | Next.js 15 + TypeScript | SPA/SSR híbrido, enrutado por archivos                |
| P2P                  | WebRTC API nativa       | Conexión directa y transferencia vía canales de datos |
| Backend (signalling) | Firebase Realtime DB    | Intercambio de ofertas/answers y ICE candidates       |
| Hosting              | Vercel                  | Deploy automático en push a `master`                  |

---

**Estado**: MVP en desarrollo 🚧
