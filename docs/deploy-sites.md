# Sites + D1 / Sites + D1

## ES · Preparación y publicación

La rama `main` también genera un Worker para Sites. El proyecto Site actual se identifica exclusivamente por `.openai/hosting.json`; **no reutilices identificadores del Site eliminado**. El Site nuevo es privado. Su D1, secretos y sesiones son independientes de Linux.

1. En el checkout de la rama `main`: `npm ci`, `npm run typecheck`, `npm test`, `npm run build:sites`. El build crea `dist/server`, `dist/client` y `dist/.openai` con las migraciones. No subas `dist/` a GitHub.
2. En Sites, configura `SESSION_SECRET` (32 bytes aleatorios codificados en 64 hexadecimales) y otro `TASK_XP_SETUP_TOKEN` distinto, ambos como secretos. No los guardes en Git. `PUBLIC_ORIGIN` es opcional en Sites: si se omite, la API compara `Origin` con la URL de la petición. Los cambios de variables requieren una nueva publicación.
3. Publica con el plugin Sites y su flujo de fuente, build y versión privada. El despliegue aplica por orden los SQL de `drizzle/` a D1 antes de subir el Worker. Verifica que el estado de despliegue sea `succeeded` y que `/api/xp` devuelva `initialized:false` antes del alta.
4. En la primera visita selecciona modo demo o personalizado, introduce el token de alta y una contraseña familiar nueva. Guarda las combinaciones animales. Tras la primera entrada familiar correcta, la copia cifrada de los códigos se elimina. Puedes retirar el token de alta del entorno y volver a publicar; una base ya inicializada rechaza otra creación.

**Desarrollo local D1:** ejecuta `npm run build:sites` una vez para generar `dist/server/wrangler.json`. Después aplica ambas migraciones a la D1 **local** en orden:

```sh
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_massive_bloodstorm.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_node_sqlite_auth.sql
npm run dev:sites                    # http://localhost:5192
```

Para desarrollo crea `.dev.vars` (ignorado por Git) con `SESSION_SECRET` y `TASK_XP_SETUP_TOKEN`. Vinext/Miniflare usa `.wrangler/state`, que **no** es la D1 publicada. No repitas `0000` sobre la misma base; las migraciones publicadas son inmutables, añade una nueva para cambios de esquema. La D1 de Sites recibe las migraciones mediante la publicación, no con `wrangler d1 execute --remote` desde este checkout.

**Actualizaciones y copias:** desde Git, usa el mismo checkout y `npm ci`, pruebas, build y nueva versión privada. Cada destino se actualiza por separado; no copiar `.env`, `.dev.vars`, `node_modules` ni bases entre máquinas. Antes de una actualización con cambios de datos, haz una copia completa de D1 con las herramientas de Sites/proveedor. La exportación JSON de Configuración traslada progreso, pero no recupera credenciales ni sesiones. Cambiar `SESSION_SECRET` invalida las credenciales Argon2id existentes: consérvalo de forma segura.

## EN · Deploy and operate

The `main` branch also builds a Worker for Sites. The **new private Site** is identified by `.openai/hosting.json`. Its D1 database, secrets and sessions are separate from Linux.

1. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build:sites`. The build emits the Worker, assets, hosting manifest and SQL migrations under `dist/`.
2. Set two different Site secrets: `SESSION_SECRET` (32 random bytes as 64 hex characters) and `TASK_XP_SETUP_TOKEN` (first-run authorization). `PUBLIC_ORIGIN` is optional on Sites; if omitted, the request URL supplies the expected origin. Redeploy after changing environment values.
3. Publish a private version through the Sites source/build/deployment workflow. It applies the ordered `drizzle/` migrations to D1 before uploading the Worker. Confirm a `succeeded` deployment and `initialized:false` from `/api/xp` before setup.
4. Choose demo or custom family mode, enter the setup token and a fresh family password, then save the generated animal combinations. The encrypted recovery copy is removed on the first successful family login. The setup token may then be removed and the Site redeployed.

For local D1 development, run the commands above and place local secrets in ignored `.dev.vars`. Wrangler's `.wrangler/state` is separate from production D1. For later schema changes, append migrations; never rewrite one already applied. Before updating production data, take a full D1 backup through the provider. The in-app JSON export contains progress only, with no credentials or sessions; it is not a full database backup. Keep `SESSION_SECRET` stable or existing Argon2id credentials become unusable.
