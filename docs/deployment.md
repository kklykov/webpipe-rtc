# Despliegue

La app se despliega automáticamente en **Vercel** al hacer push a `master`.

## Flujo CI/CD

1. Push o merge a `master` → Vercel construye y publica.
2. Variables de entorno gestionadas en el dashboard de Vercel.
3. No se requieren acciones manuales.

### Build local (opcional)

```bash
$ pnpm build
$ pnpm start  # preview prod
```

### Dominios custom

Configura tu dominio en _Settings → Domains_ dentro de Vercel.
