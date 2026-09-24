# Task eXperience

Aplicación familiar para convertir tareas y responsabilidades en progreso visible, sin rankings ni penalizaciones. Aina e Iara completan misiones, ganan Xp y proponen tareas y premios; Xavi y Mireia revisan propuestas, asignan precios y gestionan descansos. La interfaz es responsive, usa tema oscuro por defecto, incluye castellano, catalán e inglés, historial, rachas, logros, una casa animada y entrada por voz del navegador. La voz pide confirmación antes de registrar una tarea y no envía audio a un LLM.

Esta rama sustituye el runtime de Cloudflare por **Next.js sobre Node.js**, **SQLite local** y autenticación propia. La interfaz y la lógica de dominio se mantienen. El Site publicado en ChatGPT Sites sigue siendo un despliegue aparte y no cambia al trabajar en esta rama.

## Stack y persistencia

- Ubuntu 24.04 ARM64 en `erik`: Node.js 22.13 o posterior, Next.js en modo standalone, SQLite y `better-sqlite3`.
- Ubuntu 24.04 x86_64 en `mark`: nginx termina TLS público y hace proxy HTTP por la LAN a `erik`.
- No hay Docker, Cloudflare Workers ni D1 en el runtime de esta rama.
- En desarrollo la base por defecto es `./data/taskxp.db`. En producción `DATABASE_URL` **debe ser una ruta absoluta** a un disco persistente, como `/var/lib/taskxp/taskxp.db`; la app rechaza rutas relativas para evitar guardar datos dentro de `.next/standalone`.
- SQLite activa WAL, `synchronous=NORMAL`, claves foráneas y `busy_timeout=5000`. La base debe vivir en disco local de `erik`, nunca en NFS/SMB o una carpeta compartida.
- La API de dominio conserva una interfaz pequeña (`prepare/bind/first/run/batch`) para no reescribir toda su lógica de una vez; ahora la ejecuta `better-sqlite3`, sin binding D1. Drizzle también apunta a SQLite y mantiene las tablas de la app.
- La instalación inicial empieza **vacía**, con contraseña familiar y combinaciones de animales nuevas. No se copian automáticamente los datos del Site publicado ni del Wrangler local.

## Cómo funciona

El navegador abre la URL pública en `mark`. nginx termina HTTPS y reenvía la petición a Next.js en `erik` por la LAN. La ruta `/api/xp` llama a `lib/server.ts`: valida sesión, perfil y operación; `lib/domain.ts` aplica las reglas de Xp, tareas y premios; `db/index.ts` persiste el estado y las credenciales en SQLite local. El estado visible se filtra según el perfil antes de volver al navegador. El reconocimiento de voz ocurre en el navegador y pide confirmación antes de enviar una acción a la API.

El servidor standalone escucha en `HOST:PORT`; `scripts/start.mjs` transmite estos valores a Next.js. `PUBLIC_ORIGIN` debe coincidir con la URL HTTPS que usa el navegador: sirve para comprobar `Origin` en operaciones de escritura y para marcar las cookies como `Secure`. `TASK_XP_TRUST_PROXY=true` hace que el limitador de intentos use `X-Real-IP`, sobrescrito por nginx.

## Misiones y bonus semanales

El catálogo inicial incluye las tareas de ambas niñas. Hacer la cama y prepararse a tiempo dan 1 Xp al día cada una; mantener la habitación ordenada por la noche da 5 Xp; lavarse los dientes da 2 Xp por registro, hasta dos veces al día. Kids&Us Homework da 5 Xp de lunes a viernes. Siguen activas organizar el día (5 Xp diarios), la rutina de ducha (10 Xp diarios) y elegir la ropa de mañana (5 Xp diarios). La mochila del cole da 5 Xp de domingo a jueves. «Recoger mi ropa» se ha retirado.

Iara prepara la mesa para cenar de lunes a viernes (2 Xp), prepara la mochila extraescolar domingo, lunes y martes (5 Xp) y tiene el objetivo semanal de responsabilizarse de los deberes del cole (10 Xp). Aina recoge la mesa de la cena de lunes a viernes (2 Xp), prepara la mochila extraescolar lunes, martes y miércoles (5 Xp) y tiene el objetivo semanal de probar un alimento nuevo (10 Xp). Los objetivos semanales se registran una vez por semana; las tareas y objetivos se pueden editar desde la gestión parental.

La semana va de **lunes a domingo**, con fechas de `Europe/Madrid`, en los bonus y en todos los calendarios. El servidor conserva una copia de las tareas programadas para esa semana; las ediciones de tareas cuentan para bonus desde la semana siguiente. Solo la primera semana empieza a contar desde el primer acceso autenticado si la instalación se hizo a mitad de semana. En semanas posteriores se exigen todos los días programados desde el lunes. Al completar una tarea todos sus días asignados y repeticiones se concede en ese momento un bonus igual a sus Xp de esa semana (**x2 en total**). Al completar **todas** las tareas programadas se concede el superbonus de cuatro veces los Xp base (**x5 en total**), descontando los bonus x2 ya concedidos: nunca se suman ambos multiplicadores. Las pausas programadas quitan los días afectados de los requisitos; una semana sin ninguna tarea exigible no concede bonus. Las tareas de una sola vez y los huevos de Pascua no entran en el multiplicador. Las correcciones posteriores recalculan el bonus y el saldo.

El calendario marca en **plateado** los días de tareas que obtuvieron x2 y en **dorado** la semana con x5. El historial muestra el extra de Xp por separado y permite repetir la animación. La copa del logo celebra el bonus con confeti cuando se concede; cada perfil lo ve una vez, con alternativa estática si el navegador solicita menos movimiento. Los bonus son parte del saldo y de los niveles.

Con todas las tareas iniciales hechas, cada niña puede obtener **302 Xp base** por semana y **1510 Xp con el superbonus x5**. El cálculo es: 267 Xp de tareas comunes, 10 Xp de su tarea de la cena, 15 Xp de mochila extraescolar y 10 Xp de su objetivo semanal. Los huevos de Pascua quedan fuera de este máximo.

El **Super objetivo** inicial, «Traer una amiga a dormir el fin de semana», cuesta **1500 Xp**. Puede solicitarse al acumular ese saldo por cualquier vía; una semana perfecta inicial da 1510 Xp, suficientes para comprarlo directamente si no se gastaron antes. Al solicitarlo se reservan los 1500 Xp, un adulto confirma la fecha y una cancelación devuelve el saldo. La familia puede editar o archivar el premio desde la gestión parental. El cambio del premio gratuito anterior se aplica una vez al estado JSON, sin cobrar canjes históricos ni cambiar el esquema SQLite.

La sección **Reglas** de la app explica con un esquema y el catálogo vivo de tareas cómo se consiguen los bonus y cómo funcionan el saldo y los premios. Las propuestas visuales para elegir la futura interfaz están en [`docs/ui-proposals/index.html`](docs/ui-proposals/index.html): Arcade, Mapa de misiones y Agenda visual. Son HTML de demostración y no modifican los datos familiares.

## Requisitos

- Node.js 22.13+ y npm en la máquina ARM64 que compilará y ejecutará la app.
- Herramientas de compilación (`python3`, `make`, `g++`) en `erik` por si npm necesita compilar el módulo nativo de SQLite.
- nginx y certificados HTTPS públicos en `mark`.
- Una IP LAN estable para `erik` y acceso de red desde `mark`.

Instala las dependencias **en el servidor ARM64**. No copies `node_modules` ni `.next/standalone` desde Windows o desde una máquina x86_64: incluyen binarios nativos dependientes del sistema y la arquitectura.

## Desarrollo local

```sh
npm ci
npm run dev
```

Abre <http://127.0.0.1:5191>. La base se crea al primer uso en `./data/taskxp.db`. En desarrollo, la primera visita desde localhost permite crear la familia sin token de despliegue. Para verificar el build de producción y las pruebas:

```sh
npm run typecheck
npm test
npm run build
```

## Despliegue en `erik` y `mark`

### 1. Preparar `erik`

Crea un usuario de sistema dedicado y directorios persistentes; ajusta la IP de `mark` y la ruta del repositorio a tu red:

```sh
sudo useradd --system --home /opt/taskxp --shell /usr/sbin/nologin taskxp
sudo install -d -o taskxp -g taskxp -m 0750 /opt/taskxp /var/lib/taskxp
sudo -u taskxp git clone --branch linux https://github.com/hyperxaa/task-experience.git /opt/taskxp
cd /opt/taskxp
sudo -u taskxp npm ci
```

Si el repositorio ya está clonado, usa `git fetch origin && git switch linux && git pull --ff-only` en vez de clonar de nuevo.

Crea `/opt/taskxp/.env.local`, propiedad de `taskxp`, permisos `0600`. Genera dos secretos diferentes con `openssl rand -hex 32` y rellena:

```dotenv
DATABASE_URL=/var/lib/taskxp/taskxp.db
SESSION_SECRET=REEMPLAZAR_POR_64_CARACTERES_HEX_ALEATORIOS
TASK_XP_SETUP_TOKEN=OTRO_SECRETO_HEX_ALEATORIO_DE_64_CARACTERES
PUBLIC_ORIGIN=https://taskxp.example.net
PORT=5191
HOST=192.168.1.20
TASK_XP_TRUST_PROXY=true
NODE_ENV=production
```

`HOST` debe ser la IP LAN de `erik` (o `0.0.0.0`) para aceptar conexiones de `mark`. **`127.0.0.1` solo sirve si nginx está en el mismo servidor**; con `mark` separado, ese bind deja el proxy llamando a una puerta que solo existe en `erik`. Limita el puerto 5191 en el firewall de `erik` a la IP LAN de `mark`. El proxy debe sobrescribir `X-Real-IP`; no confíes ese encabezado desde otros clientes.

`PUBLIC_ORIGIN` es el origen que verá el navegador, con esquema, host y puerto si aplica, sin ruta. Se usa para validar `Origin` y decidir el atributo `Secure` de las cookies. Si la app solo se ofrece por HTTP privado, configura el origen real `http://...`; para acceso por Internet publica HTTPS en nginx.

`SESSION_SECRET` es un pepper de 32 bytes para proteger hashes Argon2id, sobre todo los códigos de animales que tienen menos combinaciones posibles que una contraseña. También cifra temporalmente los códigos pendientes de revelar. Se comprueba al crear o validar credenciales, así que consérvalo en las copias seguras: perderlo invalida las credenciales Argon2id. Los tokens de sesión/dispositivo se generan aleatoriamente, son opacos y SQLite solo guarda su SHA-256. `TASK_XP_SETUP_TOKEN` autoriza la creación inicial y no es la contraseña familiar. Ambos deben seguir fuera de Git y de logs.

```sh
sudo chown taskxp:taskxp /opt/taskxp/.env.local
sudo chmod 0600 /opt/taskxp/.env.local
sudo -u taskxp npm run build
```

El build produce `.next/standalone` para Node. Se construye en `erik` para que SQLite y Argon2 usen los binarios ARM64 correctos.

### 2. Crear el servicio systemd en `erik`

Guarda como `/etc/systemd/system/taskxp.service`:

```ini
[Unit]
Description=Task eXperience
After=network.target

[Service]
Type=simple
User=taskxp
Group=taskxp
WorkingDirectory=/opt/taskxp
EnvironmentFile=/opt/taskxp/.env.local
ExecStart=/usr/bin/node /opt/taskxp/scripts/start.mjs
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/taskxp /opt/taskxp/.next
UMask=0027

[Install]
WantedBy=multi-user.target
```

Comprueba la ruta de Node con `command -v node`; si no es `/usr/bin/node`, usa la ruta de la instalación real (por ejemplo, la de NodeSource). Activa y revisa:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now taskxp
sudo systemctl status taskxp
journalctl -u taskxp -n 100 --no-pager
curl -i http://127.0.0.1:5191/api/xp
```

El servicio crea SQLite al primer acceso. La respuesta inicial debe incluir `"initialized":false`.

### 3. Cerrar el acceso de red en `erik`

Permite 5191 solo desde `mark` (sustituye `192.168.1.10`):

```sh
sudo ufw allow from 192.168.1.10 to 192.168.1.20 port 5191 proto tcp
sudo ufw status
```

No abras el 5191 a Internet. No ubiques el archivo SQLite en una unidad de red: WAL requiere almacenamiento local y fiable.

### 4. Configurar nginx en `mark`

Ejemplo para un virtual host HTTPS ya provisto de certificados. Sustituye el nombre, certificado e IP de `erik`:

```nginx
server {
    listen 443 ssl;
    server_name taskxp.example.net;

    ssl_certificate     /etc/letsencrypt/live/taskxp.example.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/taskxp.example.net/privkey.pem;

    location / {
        proxy_pass http://192.168.1.20:5191;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Valida y recarga: `sudo nginx -t && sudo systemctl reload nginx`. La conexión `mark` → `erik` va en HTTP plano como se ha pedido; credenciales, cookies y datos pueden observarse dentro de esa LAN. Mantén esa ruta en una red de confianza y con firewall restringido; si la red no es de confianza, usa una VPN o TLS entre servidores.

## Primer acceso familiar

Abre `https://taskxp.example.net`. En la pantalla inicial introduce la contraseña familiar (10–128 caracteres) y el token `TASK_XP_SETUP_TOKEN`. La app genera cuatro códigos distintos, cada uno con cuatro animales en orden, usando el catálogo que incluye el gato bengalí. Guárdalos en el gestor familiar de contraseñas. SQLite guarda los hashes Argon2id y una copia **cifrada** de los códigos para recuperarlos si se interrumpe esta pantalla; la copia se borra al primer login correcto con la contraseña familiar. Los códigos nunca se guardan en claro. Una instalación creada con una versión anterior cifra automáticamente los códigos pendientes al recibir la primera petición.

El setup token puede retirarse de `.env.local` y reiniciar el servicio después de crear la familia. La API rechaza nuevos setups una vez inicializada la base. La entrada de contraseña y la de los códigos tienen límites de intentos persistidos en SQLite.

## Sesiones y credenciales

- Contraseña familiar y códigos se verifican con Argon2id. Tras el primer login familiar correcto se borra la copia cifrada y solo permanecen los hashes. La contraseña PBKDF2 de instalaciones previas se actualiza a Argon2id al iniciar sesión correctamente.
- Cookie de sesión `HttpOnly`, `SameSite=Strict`, `Secure` cuando `PUBLIC_ORIGIN` usa HTTPS; caduca a las 12 horas. Los tokens son aleatorios y SQLite solo contiene su SHA-256.
- «Recordar este dispositivo» crea otra cookie opaca, con vida máxima de un año. Se almacena el hash, se rota al recuperar una sesión caducada y se revoca al cerrar sesión. Cambiar la contraseña o códigos revoca los demás dispositivos.
- Los perfiles parentales se bloquean tras 15 minutos; cada perfil se vuelve a seleccionar con su código.
- La API valida `Origin` contra `PUBLIC_ORIGIN`, limita el tamaño del JSON y bloquea temporalmente los intentos **fallidos** por IP cuando `TASK_XP_TRUST_PROXY=true` y nginx sobrescribe `X-Real-IP`. Los accesos correctos no consumen el límite.
- La primera instalación no incluye ninguna contraseña predeterminada, endpoint de login de ChatGPT ni mock de autenticación.

## Actualizaciones y copias de seguridad

Haz cada actualización desde `erik`. Primero crea una copia consistente con la API de backup de SQLite mientras la app sigue funcionando. Después para el servicio antes de cambiar dependencias o reconstruir `.next`; `next build` limpia esa carpeta y el servicio en ejecución la necesita.

```sh
cd /opt/taskxp
sudo -u taskxp env DATABASE_URL=/var/lib/taskxp/taskxp.db npm run backup
sudo -u taskxp git fetch origin
sudo systemctl stop taskxp
sudo -u taskxp git switch linux
sudo -u taskxp git pull --ff-only
sudo -u taskxp npm ci
sudo -u taskxp npm run typecheck
sudo -u taskxp npm test
sudo -u taskxp npm run build
sudo systemctl start taskxp
sudo systemctl status taskxp
```

También puedes hacer una copia en cualquier momento sin parar el servicio:

```sh
cd /opt/taskxp
sudo -u taskxp env DATABASE_URL=/var/lib/taskxp/taskxp.db npm run backup
```

El script crea `/var/lib/taskxp/backups` con permisos `0700`, guarda una copia íntegra con permisos `0600`, comprueba su integridad y muestra la ruta creada. Incluye las transacciones aún pendientes en el WAL. No copies solo `taskxp.db` mientras la app está activa ni confíes en que una parada siempre vacíe el WAL. Conserva copias fuera de `erik` y ensaya restauraciones. La exportación desde la aplicación solo contiene tareas, progreso y premios; no incluye credenciales ni sesiones y no sustituye a la copia SQLite.

## Desarrollo y legado de Cloudflare

La base D1 del Site publicado y la D1 local de Wrangler son independientes. Esta rama no modifica ni sincroniza el Site. La nueva SQLite arranca vacía por elección; el JSON exportado previamente no se importa automáticamente porque no contiene credenciales. Para cualquier importación futura, valida primero el estado y establece contraseña y códigos nuevos.

`scripts/reset-local-password.mjs` es una utilidad heredada solo para desarrollo. Se niega a ejecutarse con `NODE_ENV=production` y no forma parte del bundle standalone. No es una herramienta de restablecimiento para la SQLite de producción.
