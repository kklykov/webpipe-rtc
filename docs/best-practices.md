# Buenas prácticas

## Convenciones de nombres

- **Componentes React**: archivo y export `PascalCase` (`Chat.tsx`).
- **Hooks / utils**: `camelCase` (`useWebRTC.ts`).
- Carpeta `/components/app` para lógica de negocio; `/components/ui` para elementos puros de UI.

## Estructura de carpetas recomendada

```
app/             # Rutas Next.js (App Router)
components/
  app/           # Componentes con lógica específica
  ui/            # Componentes presentacionales reutilizables
hooks/
store/           # Zustand
config/          # Config & factories (Firebase, WebRTC, nombres únicos)
docs/            # Documentación
```

## Estilo de código

- ESLint y Prettier heredados de Next.js 15 defaults.
- Comments ENGLISH, código y docs ESPAÑOL (requerimiento del equipo).

## Commits & PRs

- Sin estándar estricto; se sugiere **feat/fix/chore** + descripción breve.

## QA rápida

- `yarn lint` para detectar problemas.
- `yarn build` antes de crear PR.
