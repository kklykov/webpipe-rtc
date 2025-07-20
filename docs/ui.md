# Lineamientos de UI/UX

> **Nota:** Se adjuntan dos capturas (`img/minimal-chat-1.png`, `img/minimal-chat-2.png`) como referencia visual. Colócalas en `docs/img/` para que los enlaces funcionen.

## Filosofía de diseño

- **Minimalismo absoluto**: la interfaz debe distraer lo mínimo posible.
- Predominio de tonos oscuros (`bg`, `gray.*`) para suavizar la fatiga visual.
- Elementos de acción (botones, links) resaltan con colores semánticos (`green.solid`, `orange.solid`).

## Layout

| Zona               | Descripción                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| **Header**         | Info de sala y estado de conexión. Icono indicador con color semáforo.                            |
| **Historial**      | Mensajes a la derecha (propios) e izquierda (peer). Archivos en tarjetas con progreso y acciones. |
| **Sidebar mobile** | Avatar + nombre cuando el viewport es _base_.                                                     |
| **Input**          | Campo texto + botón 📎 + botón enviar.                                                            |

![Minimal chat screenshot](img/minimal-chat-1.png)

## Comportamientos clave

- **Drag & Drop**: al arrastrar archivos, sobreponer un _overlay_ gris claro con texto indicativo.
- **Progreso**: barra de 4 px con animación suave (`w={progress}%`).
- **Confirmaciones**: cambiar icono a `CheckCircle` al terminar envío/recepción.

![Overlay drag & drop](img/minimal-chat-2.png)

## Accesibilidad

- Contraste AA en texto y botones (`chakra-theme` ya cubre la mayor parte).
- Navegación con teclado: Tab indica focus en botones e inputs.
- Anunciar estados (enviar/recibir) con `aria-live="polite"` en futuras mejoras.
