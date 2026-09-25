# Task eXperience

![Task eXperience trophy](public/task-experience-emoji.png)

**ES** · Una app privada para que una familia convierta sus responsabilidades diarias en misiones, Xp y premios. Cada niño tiene su propio progreso; los adultos configuran misiones, revisan propuestas y confirman canjes. No hay rankings entre hermanos.

**EN** · A private family app that turns everyday responsibilities into missions, Xp and rewards. Each child has separate progress; adults manage missions, review suggestions and confirm redemptions. There are no sibling rankings.

## ES · Qué incluye

- Misiones diarias, semanales, de todo el día y con varias repeticiones; calendario, rachas, niveles, historial y correcciones.
- **Bonus ×2** cuando una misión se completa todos sus días y repeticiones de la semana. **Superbonus ×5** cuando se completan todas las misiones; sustituye al ×2, no se acumula encima. Las semanas van de lunes a domingo en `Europe/Madrid`.
- Premios pagados con el saldo de Xp, propuestas de los niños y aprobación de los adultos. Los cambios en las misiones conservan los registros históricos; las misiones nuevas empiezan a contar desde su día de alta para el superbonus, pero no reciben ×2 esa primera semana.
- Descubrimientos ocultos, celebraciones y casa animada; interfaz adaptable, tema oscuro, castellano/catalán/inglés y entrada de voz del navegador con confirmación antes de registrar Xp.
- Primer arranque con **modo personalizado** (adultos e hijos definidos por la familia, sin exigir padre y madre) o **modo demo** (Xavi, Mireia, Aina e Iara y sus misiones iniciales). El modo demo funciona como una instalación normal, sin distintivos ni datos de actividad pregrabados.

## EN · What it does

- Daily, weekly, all-day and repeatable missions; calendar, streaks, levels, history and corrections.
- A **×2 bonus** for completing every scheduled occurrence of one mission in a week. A **×5 super bonus** for completing all missions replaces the ×2; it does not stack. Weeks run Monday–Sunday in `Europe/Madrid`.
- Rewards bought with earned Xp, child suggestions and adult approval. Mission edits preserve past records; new missions count from their start day toward the super bonus, but cannot earn ×2 in their first partial week.
- Hidden discoveries, celebrations and an animated home; responsive dark UI in Spanish/Catalan/English and browser voice input that requires confirmation before Xp is recorded.
- First-run **custom mode** for any family with at least one adult and child, or **demo mode** with Xavi, Mireia, Aina and Iara and their preset missions. Demo mode is a normal, empty-data installation with no visual badge.

## Dos destinos / Two deployment targets

| | Linux / Node | Sites / Workers |
| --- | --- | --- |
| App | Next.js standalone, Node.js 22.13+ | Vinext, Cloudflare Workers |
| Data | Local SQLite, `better-sqlite3`, WAL | Cloudflare D1 |
| Build | `npm run build:node` | `npm run build:sites` |
| Start / deploy | `npm start` behind HTTPS reverse proxy | Private Site via the Sites plugin |

Both builds use the **same UI, API controller and Xp rules**. Runtime-specific database and configuration adapters are selected at build time. Each installation has its **own** data, secrets and sessions; deploying the same commit does not synchronize them. A parent may export/import progress as JSON between installations with the same family members; credentials and remembered devices are excluded. Back up SQLite or D1 separately for a complete recovery.

Ambas compilaciones usan **la misma interfaz, API y reglas de Xp**. Los adaptadores de base y configuración se eligen al compilar. Cada instalación tiene sus **propios** datos, secretos y sesiones. El JSON exportado/importado traslada progreso entre instalaciones con los mismos miembros, pero no credenciales ni dispositivos; haz además copias completas de SQLite o D1.

## Arranque rápido / Quick start

```sh
npm ci
npm run typecheck && npm test
npm run dev:node       # http://127.0.0.1:5191; local SQLite in ./data/
# or / o bien
npm run dev:sites      # local Workers + D1; see docs/deploy-sites.md
```

In production, configure a fresh 64-character hex `SESSION_SECRET`, a **different** `TASK_XP_SETUP_TOKEN` for the first setup, and the browser's `PUBLIC_ORIGIN` when using a reverse proxy. Never commit `.env.local`, a database, tokens or build directories. The family password and four-animal codes use Argon2id; session and remembered-device cookies are HttpOnly, and only hashes of their random tokens are stored. Adult permissions come from stored member roles, never a browser-supplied name.

En producción, configura un `SESSION_SECRET` aleatorio de 64 caracteres hexadecimales, otro `TASK_XP_SETUP_TOKEN` distinto para el alta inicial y `PUBLIC_ORIGIN` si hay proxy inverso. No subas `.env.local`, bases, tokens ni carpetas de build a Git. Contraseña y códigos animales usan Argon2id; las cookies de sesión y dispositivo son HttpOnly y en la base solo se guardan hashes de sus tokens. El permiso adulto depende del rol persistido.

**Guías / Guides:** [Linux y nginx (ES)](docs/deploy-node.es.md) · [Sites y D1 / Sites and D1 (ES/EN)](docs/deploy-sites.md) · [arquitectura / architecture (ES/EN)](docs/architecture.md) · [propuestas visuales / UI proposals](docs/ui-proposals/index.html).
