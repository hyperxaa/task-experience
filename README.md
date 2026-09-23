# Task eXperience

Aplicación familiar para convertir tareas y responsabilidades en progreso visible, sin rankings ni penalizaciones. Aina e Iara completan misiones, ganan Xp, proponen tareas y premios; Xavi y Mireia revisan propuestas, asignan precios, corrigen registros y gestionan descansos. El saldo de Xp no caduca.

La interfaz es responsive, tiene tema oscuro por defecto y puede instalarse como aplicación web en dispositivos compatibles. Incluye castellano, catalán e inglés, historial de progreso, rachas, logros, una casa animada y pequeñas sorpresas ocultas. La entrada por voz usa el reconocimiento del navegador cuando está disponible y pide confirmación antes de registrar una tarea; no usa un LLM ni requiere una clave de API.

## Sitio en Sites

- **URL publicada:** [Task eXperience](https://task-experience.hyper-xaa.chatgpt.site/).
- **Acceso actual:** público en Sites; cualquiera con el enlace puede abrir la pantalla inicial. Para acceder a los perfiles siguen haciendo falta la contraseña familiar y la combinación de animales correspondiente. La visibilidad del Site se gestiona en Sites y es independiente del acceso interno de la aplicación.
- **Datos:** el Site usa su propia base Cloudflare D1, declarada como `DB` en [`.openai/hosting.json`](.openai/hosting.json). La base publicada se creó vacía: los Xp, tareas e historial del entorno local **no se migraron ni se sincronizan automáticamente**. La aplicación permite exportar datos a JSON desde un perfil parental, pero todavía no dispone de importación.
- **Primer acceso:** el propietario crea una contraseña familiar y utiliza el código de configuración del alojamiento. Este código está guardado como secreto `TASK_XP_SETUP_TOKEN` en Sites; no debe añadirse al repositorio. Las combinaciones iniciales de cuatro animales se muestran una sola vez, por lo que hay que guardarlas.

El ciclo cierra inicialmente los **viernes a las 18:00, hora de Madrid**. Los padres pueden cambiar el día y la hora en Objetivos; las vistas semanales se ordenan para que el cierre quede al final. Los Xp acumulados permanecen disponibles después del cierre.

## Desarrollo local

Requiere Node.js 22.13 o posterior. Desde esta carpeta:

```powershell
npm ci
npm run dev -- --port 5191 --hostname 127.0.0.1
```

Abrir `http://127.0.0.1:5191/`. El desarrollo local usa una base D1 simulada en `.wrangler/state/`, separada de la base publicada. En una instalación local nueva, generar el Worker y aplicar la migración antes de utilizar la app:

```powershell
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_massive_bloodstorm.sql
```

La primera visita local permite crear la contraseña familiar sin código de alojamiento. Para restablecerla **solo en este equipo**, sin borrar tareas ni Xp, se puede ejecutar `node scripts/reset-local-password.mjs`. Ese comando no recupera ni modifica la contraseña del Site publicado.

## Comprobaciones

```powershell
node node_modules/typescript/bin/tsc --noEmit
node --test tests/access.test.mjs tests/domain.test.mjs tests/house-motion.test.mjs
npm run build
```

El código de la interfaz está en `app/`; las reglas de tareas, saldo, permisos y ciclos en `lib/`; la API y la persistencia en `app/api/xp/route.ts` y `lib/server.ts`; y el esquema y las migraciones D1 en `db/` y `drizzle/`. Los cambios locales no se publican solos: deben compilarse y desplegarse como una nueva versión de Sites.
