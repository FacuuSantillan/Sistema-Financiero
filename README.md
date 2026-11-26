# Sistema Financiero

Aplicación de gestión de préstamos: inversionistas, clientes, planes de préstamo, préstamos y cobros, con estadísticas y registro de auditoría.

## Tecnologías

- React 19 + Vite + Tailwind CSS
- Supabase (PostgreSQL + autenticación)
- Tauri (app de escritorio) y Capacitor (iOS)

## Configuración

1. Instalar dependencias: `npm install`
2. Copiar `.env.example` a `.env` y completar los datos de Supabase.
3. En Supabase → SQL Editor, ejecutar [db/schema.sql](db/schema.sql) completo. Crea las tablas, las reglas de seguridad (RLS), el bucket de fotos y las provincias. Se puede volver a ejecutar sin perder datos.
4. Crear el usuario owner siguiendo el paso 5 del final de `db/schema.sql`.

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo web |
| `npm run build` | Compilación de producción en `dist/` |
| `npm run tauri dev` | App de escritorio en modo desarrollo |
| `npm run tauri build` | Instalador de escritorio |
| `npx cap sync ios` | Copia `dist/` al proyecto de iOS |

## Roles

- **owner**: acceso total, crea administradores y ve los registros de auditoría.
- **admin**: gestiona inversionistas, clientes, planes y préstamos; ve estadísticas.
- **inversionista**: ve sus clientes y registra cobros.
