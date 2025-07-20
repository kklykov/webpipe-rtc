# Desarrollo local

```bash
# Clonar
$ git clone <repo>
$ cd webpipe-rtc

# Instalar deps
$ pnpm i  # o yarn / npm ci

# Variables de entorno obligatorias
cp .env.example .env.local
#  - FIREBASE_API_KEY=...
#  - FIREBASE_PROJECT_ID=...
#  - (etc.)

# Ejecutar en modo dev
$ pnpm dev     # http://localhost:3000
```

### Scripts útiles

| Script  | Descripción             |
| ------- | ----------------------- |
| `dev`   | Next.js hot-reload      |
| `build` | Compila para producción |
| `lint`  | ESLint + TypeScript     |

### Requisitos

- Node ≥ 18
- Navegador con soporte WebRTC (Chrome, Edge, Firefox, Safari moderno)
