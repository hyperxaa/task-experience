# Plan: una app para Linux y Sites

Estado: implementación completada en la rama `linux`. Pasan typecheck, lint, 53 pruebas y los builds de Node y Sites. El Site se publicó de forma privada y la rama `linux` está actualizada en GitHub. Revisión: 26 de septiembre de 2026.

## Resultado esperado

Un único código de interfaz y reglas familiares, con dos destinos de compilación y despliegue:

| Destino | Ejecución | Persistencia | Publicación |
| --- | --- | --- | --- |
| Linux | Next.js standalone sobre Node | SQLite local con better-sqlite3 y WAL | Git, build en erik, systemd y nginx en mark |
| Sites | Build compatible con Workers mediante la integración admitida por Sites | D1 | Nuevo Site y despliegue mediante Sites |

Ambos destinos incluirán el mismo asistente de primera instalación para un adulto responsable: **modo personalizado**, con los miembros que defina esa familia, o **modo demo**, con Xavi, Mireia, Aina e Iara y la configuración familiar actualmente definida en el código. El usuario utilizará modo demo para su familia real; será una instalación funcional y persistente, sin distintivos, limitaciones ni cambios visuales por llamarse demo.

Cada instalación mantiene sus propios datos, secretos y sesiones. Compartir código no sincroniza las bases. Se reutiliza el formato de exportación/importación de progreso; las credenciales se configuran en cada instalación. La sincronización automática y un backend compartido quedan fuera del alcance.

La rama `linux` contiene los cambios recientes y será la base. `main` sirve como referencia de la integración anterior de Sites; no se reemplazará la lógica actual por la antigua. Se desarrollará un solo producto, con comprobaciones para los dos destinos en cada cambio. No se mantendrán dos implementaciones de las reglas de Xp.

## Lo que ya facilita la adaptación

- `lib/domain.ts`, `lib/cycles.ts`, `lib/weekly-bonuses.ts` y `lib/discoveries.ts` contienen la lógica compartida.
- `db/index.ts` ya presenta SQLite mediante una interfaz parecida a D1: consultas preparadas y operaciones en lote. Sus tipos y ejecución síncrona necesitan un contrato común asíncrono.
- `lib/server.ts` usa Request/Response y concentra autenticación, permisos y acciones. También importa directamente Argon2, Node crypto, variables de entorno y la base: este es el acoplamiento principal a extraer.
- `app/api/xp/route.ts` es pequeño; podrá seguir delegando en el mismo controlador con dependencias elegidas para cada destino.
- Hay dos migraciones SQL y un esquema Drizzle. Se comprobará su equivalencia con el DDL que actualmente ejecuta `db/index.ts` al arrancar.
- Las pruebas de acceso actuales usan una base en memoria y un sustituto de `batch` sin transacción. Sirven para comportamiento, pero no demuestran compatibilidad ni atomicidad de los adaptadores reales.
- Los tipos `Person` y `Child`, `names`, `isParent` y parte de la inicialización presuponen los cuatro miembros actuales. La configuración de familias exige convertirlos en perfiles persistidos con identificador y rol; cambiar solo los nombres visibles sería insuficiente.

## Fase 1. Resolver la viabilidad de Sites

Preparar una prueba mínima de compilación Workers con la integración actual de Sites, sin modificar el despliegue Node. Conservar Next.js standalone para Linux y evaluar Vinext únicamente para el destino Sites. Reutilizar piezas compatibles del proyecto anterior, comprobando sus versiones y contratos; no copiar todo su tooling por defecto.

Resolver primero Argon2id: el paquete nativo usado en Node no se puede tratar como una dependencia portable. Evaluar una implementación mantenida para Workers, por ejemplo WebAssembly, con el mismo formato de hash y los mismos parámetros criptográficos. Mantener el secreto pepper y verificar compatibilidad de hashes en ambos sentidos.

Medir creación inicial y desbloqueo con un número variable de perfiles, cambio de credenciales y peticiones simultáneas. El modo demo requiere cinco hashes iniciales y hasta cuatro verificaciones para localizar un código; el modo personalizado debe probarse también con familias de distinto tamaño. Establecer límites técnicos explícitos y razonables a partir de estas mediciones, sin fijar la familia a dos adultos y dos hijos. Medir memoria, tiempo y tamaño del bundle bajo las restricciones efectivas de Sites. Los límites generales de Workers no prueban los límites asignados por Sites. Web Crypto podrá cubrir las primitivas disponibles, pero no sustituye por sí solo a Argon2id.

**Condición de avance:** el build Workers funciona y la autenticación cumple los requisitos de seguridad y recursos. Si no existe una opción viable, documentar el límite y decidir una arquitectura de autenticación alternativa antes de continuar; no reducir silenciosamente el coste de los hashes ni sustituirlos por SHA-256 para contraseñas.

## Fase 2. Separar dependencias manteniendo Linux operativo

Introducir contratos pequeños para base de datos, criptografía y configuración del servidor. Convertir `lib/server.ts` en un controlador creado con esas dependencias; eliminar la inyección de pruebas mediante variables globales. El controlador recibe la configuración y el contexto de petición, sin importar el runtime de Cloudflare ni módulos nativos directamente.

Estructura orientativa, sin mover innecesariamente la lógica de dominio:

```text
lib/domain.ts, cycles.ts, weekly-bonuses.ts, discoveries.ts   reglas compartidas
lib/server.ts                                               controlador compartido
lib/platform/contracts.ts                                   contratos
lib/platform/node.ts                                        composición Node
lib/platform/sites.ts                                       composición Workers
lib/auth/                                                   política común y proveedores crypto
db/node.ts                                                  better-sqlite3
db/sites.ts                                                 D1
db/schema.ts + drizzle/                                     esquema y migraciones comunes
```

La selección del adaptador se resolverá al compilar, mediante entradas o alias específicos. El bundle Sites no debe incluir better-sqlite3, Argon2 nativo ni acceso al sistema de archivos; el build Node no debe resolver imports de `cloudflare:workers`. Los bindings de Workers se obtienen del contexto válido de ejecución, sin compartir conexiones o configuración entre peticiones mediante globals mutables.

**Condición de avance:** la versión Node conserva todos los comportamientos actuales y pasa las pruebas y el build antes de activar el segundo destino.

## Fase 3. Configuración inicial de la familia

### Flujo y modos

En una instalación nueva, el primer acceso autorizado como adulto responsable abrirá el asistente de configuración familiar. Se apoyará en la autorización inicial y las credenciales de instalación para crear el primer adulto de forma segura; no se podrá obtener permiso parental simplemente enviando un rol desde el navegador. El diseño resolverá el alta del primer adulto antes de exigir un código de un perfil que todavía no existe.

El asistente ofrecerá estas dos opciones:

- **Modo personalizado:** definir los adultos responsables y los hijos, sus nombres y los datos de perfil necesarios. Admitir parejas del mismo sexo, parejas de distinto sexo y familias con un solo adulto, sin exigir una combinación de padre y madre. El permiso depende del rol adulto/hijo, nunca del sexo, el nombre o el avatar. El género no será un dato obligatorio para poder crear la familia. No fijar dos adultos ni dos hijos en la lógica.
- **Modo demo:** cargar Xavi y Mireia como adultos, Aina e Iara como hijas, con los colores, perfiles, misiones, horarios, premios y demás valores iniciales ya definidos para esta familia. Mantener sus asociaciones actuales y la presentación habitual de la aplicación.

La etiqueta «Modo demo» aparecerá en la elección inicial; después no habrá banners, insignias, marcas de agua, menús adicionales ni cambios de comportamiento por el modo seleccionado. Demo significa aquí un conjunto de datos iniciales predefinidos: los cambios y el progreso se guardan normalmente. La interfaz del modo personalizado conserva el diseño de la app y muestra sus propios miembros; no deben aparecer nombres de la familia demo por referencias fijas olvidadas.

Una instalación nueva comenzará sin Xp ni historial previamente ganados. El modo demo carga la configuración inicial del código, no copia la SQLite privada, las contraseñas, los códigos animales, las sesiones ni la actividad real de otra instalación. Se generan credenciales y códigos únicos para los miembros elegidos. El modo personalizado usará las misiones generales apropiadas; las misiones específicas de Aina/Iara no se asignarán automáticamente a otros hijos por posición, género o nombre.

### Modelo compartido y alcance de los cambios

Persistir un catálogo de miembros con identificadores estables, nombre visible, rol y presentación necesaria. Referenciar esos identificadores desde sesiones, credenciales, misiones, premios, preferencias, canjes, planes semanales, celebraciones y registros históricos. Separar la plantilla demo del motor de reglas y del generador de estado inicial personalizado.

Actualizar permisos y filtros del servidor, selector de perfiles e hijos, progreso, menús, textos ES/CA/EN, voz, logros, colores y residentes de la casa animada para que trabajen con ese catálogo. Los nombres y roles no se deducen uno de otro. Un nombre repetido no identifica a un perfil: las acciones usan su identificador y la configuración debe permitir distinguir a las personas. No recoger fechas de nacimiento ni otros datos personales que no sean necesarios.

El estado de configuración será explícito y persistente. La creación de miembros, credenciales y estado familiar se confirmará de forma coherente: una interrupción o dos navegadores completando el asistente a la vez no pueden crear dos familias ni dejar una familia parcialmente configurada. Una vez terminado, el asistente no reaparece con cada login, reinicio o actualización; los hijos no pueden volver a ejecutarlo.

Las instalaciones actuales migrarán conservando los identificadores de Xavi, Mireia, Aina e Iara, sus credenciales, colores, asignaciones e históricos, y quedarán marcadas como configuradas. Revisar y versionar el formato JSON de exportación/importación para incluir miembros y validar sus referencias y permisos; los backups antiguos de la familia actual se migrarán de forma compatible. No transferir credenciales o sesiones mediante el backup de progreso.

«Empezar de nuevo» seguirá restableciendo progreso y catálogo según su confirmación, conservando el acceso y la familia configurada. En modo personalizado nunca debe recrear silenciosamente a Xavi, Mireia, Aina e Iara. La gestión posterior de altas, bajas o cambios de rol es un alcance distinto al asistente inicial y no se incorpora automáticamente a esta fase.

**Condición de avance:** las dos opciones funcionan igual en ambos destinos; el modo demo conserva la apariencia y configuración familiar actuales, y el personalizado admite familias de distintas composiciones sin nombres demo residuales, permisos basados en identidades fijas ni cruces de datos entre hijos. Las instalaciones existentes mantienen todo su progreso y acceso.

## Fase 4. Persistencia equivalente

Implementar el mismo contrato con consultas parametrizadas, `first`, `run`, resultado de filas modificadas y `batch` atómico. En Node el lote usa una transacción síncrona real de better-sqlite3; en D1 usa su operación nativa `batch`. El contrato no prometerá transacciones arbitrarias con callbacks asíncronos.

Conservar el control de concurrencia mediante `revision` y los reintentos limitados para acciones. Un UPDATE condicional que modifica cero filas no es un error SQL ni provoca rollback por sí solo: las operaciones dependientes deben comprobar o condicionar explícitamente su efecto. Cubrir especialmente rotación de dispositivo, cambio de credenciales, doble creación inicial e importación de progreso.

Usar una única secuencia de migraciones SQL para instalaciones nuevas y existentes. Antes de cambiar el arranque, comprobar el caso de las SQLite existentes cuyo esquema se creó automáticamente sin el mismo registro de migraciones. No alterar el contenido de la familia ni reinicializar bases existentes.

**Condición de avance:** igualdad de resultados en SQLite y D1 local, rollback completo ante un fallo SQL intermedio, y ausencia de doble abono al repetir peticiones o ejecutar acciones simultáneas.

## Fase 5. Autenticación y configuración por entorno

Conservar contraseña familiar, ANIMAL CODE, sesión de 12 horas, dispositivo recordado rotativo de un año y permisos parentales. La política se comparte; los proveedores criptográficos se adaptan según lo validado en la primera fase. Mantener hashes, cifrado de códigos pendientes y verificación de credenciales antiguas de Linux.

Node seguirá leyendo configuración privada del servidor. Sites recibirá bindings y secretos a través de sus herramientas. Ambos validarán origen, tamaño de petición, errores y cookies. Configurar IP de cliente según el proxy fiable de cada entorno: X-Real-IP de nginx en Linux y la información fiable que realmente proporcione Sites. No dar por válido un encabezado enviado libremente por el navegador.

La protección propia de la familia será independiente de la audiencia configurada en Sites. No recuperar el mock de login de ChatGPT ni confiar en `oai-authenticated-user-*` para decidir permisos familiares.

**Condición de avance:** los mismos escenarios de sesión, revocación, bloqueo de intentos, separación entre niñas y permisos parentales pasan en ambos destinos, incluidos los accesos desde dos dispositivos.

## Fase 6. Dos builds y verificación continua

Hay comandos explícitos `dev:node`, `build:node`, `start:node`, `dev:sites` y `build:sites`; `npm run build` y `npm start` siguen funcionando en Linux. Las pruebas compartidas se ejecutan con `npm test` en ambos builds.

Separar los directorios de salida de Node y Sites. Mantener un lockfile reproducible y documentar dependencias de cada destino. Añadir una comprobación continua que ejecute las reglas compartidas, las pruebas de contrato de cada adaptador, los tipos y los dos builds. El pipeline no publicará automáticamente cambios en producción.

Verificar contra better-sqlite3 real y Workers/D1 local; la emulación SQLite actual no basta. Incluir bonus ×2 y ×5, misiones nuevas a mitad de semana, históricos, correcciones, canjes, descubrimientos, importación/exportación y concurrencia. Probar la migración con una copia de la SQLite anterior y el arranque sobre una base vacía. Comprobar ambos builds desde el mismo commit y revisar que las dependencias excluidas no aparezcan en el destino incorrecto.

Añadir escenarios de primera instalación en modo demo y personalizado, dos padres, dos madres, un adulto, distinto número de hijos, nombres repetidos, acceso infantil al asistente, reintento/interrupción de configuración y actualización de una instalación ya configurada. Comprobar reset e importación sin introducir miembros demo en una familia personalizada. La igualdad del comportamiento de ambos modos se comprueba sobre los adaptadores reales; la configuración familiar pertenece a la lógica compartida.

**Condición de avance:** ambas versiones muestran los mismos resultados para las mismas acciones y no hay regresiones de funcionamiento en Node.

## Fase 7. Nuevo Site y documentación operativa

El usuario eliminó el Site anterior. Se registró una vez el Site nuevo y su identificador real está en `.openai/hosting.json`. El nuevo Site es privado y sus secretos ya están configurados; aún no se ha publicado una versión ni inicializado su familia. No reutilizar el identificador del Site eliminado.

El primer despliegue será privado, con D1 nueva y secretos propios. Arrancará sin familia configurada y mostrará el asistente al primer adulto autorizado, con las opciones personalizado/demo. La opción prevista por el usuario es modo demo; seleccionarla crea la familia predefinida sin actividad previa. Importar progreso será una operación explícita posterior, sin trasladar contraseñas ni sesiones. La comprobación de recursos de autenticación se completará en el entorno real antes de habilitar uso familiar. Se confirmará el estado exitoso del despliegue y la URL devuelta por Sites.

Actualizar el README con dos rutas de instalación y actualización, el asistente familiar y el significado de modo demo, una tabla de variables por destino, backup/restauración, recuperación de errores y límites conocidos. Las copias completas de SQLite y D1 tendrán procedimientos propios; la exportación JSON de progreso no se describirá como una copia de credenciales o sesiones.

Publicar en GitHub una versión identificable que contenga ambos destinos. La implantación en erik sigue siendo un proceso independiente. Revertir código después de modificar una base exige verificar compatibilidad del esquema y de los datos o restaurar una copia; un simple checkout no garantiza una recuperación segura.

## Criterio de finalización

La adaptación termina cuando el mismo commit genera ambas versiones, las pruebas de comportamiento y seguridad pasan en cada runtime, una SQLite anterior se conserva correctamente, el asistente permite configurar cualquiera de los dos modos sin cambios visuales propios del modo demo, y el Site privado nuevo funciona con su propia D1. El README debe permitir a otro agente desplegar y actualizar cualquiera de los destinos sin copiar archivos generados ni secretos.

## Referencias contrastadas

- [Vinext: compatibilidad y coexistencia con Next.js](https://github.com/cloudflare/vinext). Su compatibilidad no es universal; se comprobará la app concreta.
- [D1: consultas y transacciones mediante batch](https://developers.cloudflare.com/d1/worker-api/d1-database/).
- [Workers: límites de ejecución y memoria](https://developers.cloudflare.com/workers/platform/limits/). Los límites efectivos de Sites se verificarán por separado.
- [Web Crypto en Workers](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/).

El flujo de empaquetado, registro y publicación seguirá las guías del plugin Sites instalado al ejecutar el trabajo.
