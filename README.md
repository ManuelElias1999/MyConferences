# MyConferences

Plataforma de eventos online que se recorren como un evento real, pensada sobre todo para charlas de tecnología. Las empresas crean sus eventos con la temática que quieran, su agenda y los logos de sus patrocinadores. Los asistentes llegan a una recepción, le dicen a la recepcionista el número del evento y entran a un recinto grande con pasillos, salas, anuncios y gente conversando, y el auditorio principal con su propia entrada. Cada temática tiene un plano distinto. Para escuchar una charla hay que caminar hasta su sala; al entrar, el personaje se sienta y se ve lo que comparte el ponente.

La estética es de bloques: personajes cuadrados, muebles cuadrados y una interfaz de esquinas rectas.

## Cómo funciona

### Para las empresas

- El botón **＋ Crear evento** está siempre arriba. Si no tienes cuenta, te registra como empresa. Si tienes una cuenta personal, la convierte en cuenta de empresa. Luego abre el panel en «Nuevo evento».
- En el panel (**Mis eventos**) se configura cada evento:
  - nombre y descripción;
  - **temática** del recinto: tecnológica, minimalista, rústica, medieval o jardín, con vista previa del recinto completo;
  - **acceso**: privado (solo los correos de la lista) o abierto;
  - **salas y agenda**: el **auditorio principal** y entre **8 y 16 salas** (las primeras ocho van en la planta baja y las demás en el piso de arriba), cada una con su color, su **código de ponente** y sus charlas (título, ponente, hora de inicio y duración). Cada sala tiene una distribución distinta: aula, taller con mesas, anfiteatro en U o sala ancha;
  - **logo del evento**: aparece en la pantalla gigante del lobby (si no hay logo, se muestra el nombre);
  - **patrocinadores**: logos en PNG, JPG o WebP con su sitio web opcional. Rotan en las pantallas gigantes de la fachada del auditorio, en los tótems de la plaza y en las pantallas de cada sala.
- Cada evento recibe un **número** para compartir con los invitados. La empresa siempre puede entrar a su propio evento con «Visitar mi evento», y también puede cerrarlo: quien esté dentro vuelve a recepción.

### Para los asistentes

- **Recepción**: un cowork pequeño; la recepcionista está a pocos pasos. Te acercas, pulsas X (o le haces clic) y le das el número del evento. Los eventos privados piden iniciar sesión y revisan que tu correo esté en la lista de invitados.
- **Recinto del evento**: cada temática tiene su propio plano y dos pisos. En la planta baja están el auditorio principal y ocho salas; arriba, hasta ocho salas más y una terraza. En el lobby hay una **pantalla gigante con el logo del evento**, y en todos los planos hay espacios para charlar y descansar:
  - **Tecnológica (campus futurista)**: lobby con dos salas de estar, cafetería, zona de juegos (ping-pong, futbolito, arcades), patio con sombrillas, alas con las salas y, arriba, sky lounge y zona chill.
  - **Medieval (castillo)**: patio de armas con fuentes y jardines, taberna, sala de juegos con mesas de ajedrez, galerías y torres. Arriba, la **azotea** con almenas, catalejos, braseros y su jardín.
  - **Jardín (parque)**: pícnic, café del jardín con sombrillas, zona recreativa y un mirador arriba.
  - **Minimalista (galería tipo museo)**: lounge, jardín interior, café y estudio de juegos; arriba, terraza y biblioteca.
  - **Rústica (pueblo)**: calles con salas, fonda, plaza de juegos y huertos; arriba, un altillo con terraza.
  - En todos, la entrada del auditorio es monumental (columnas, puertas dobles y marquesina con luces).
  - Las salas van **de a dos** y en distintas zonas (2 · 2 · 2 · 2 + el auditorio). Algunas tienen la puerta de frente y otras en un muro lateral. Cada sala es un edificio con su nombre en el techo.
  - Entre una zona y otra hay **portales con el nombre de la zona** o carteles con flecha («← CAFETERÍA», «JUEGOS →»).
  - Las paredes tienen un color bien distinto al piso, y el piso es liso, sin dibujos.
  - Las **escaleras** son anchas, con barandas y una flecha: la que sube se mete en el muro y la que baja es un hueco con baranda. Basta pisarlas para cambiar de piso.
- **Sin choques**: solo las paredes cortan el paso. Muebles y personas se pueden atravesar, aunque los caminos automáticos rodean los muebles.
- **Cámara**: tu personaje siempre queda al centro de la pantalla; solo se mueve del centro al llegar a los bordes del recinto.
- **Puertas**: cada una muestra el nombre de la sala, la charla en curso o la próxima, y su horario (por ejemplo «10:00–10:45»).
- **Directorio**: los tótems con **?** (y el botón «Cómo llegar a cada sala») muestran dónde está cada sala y qué charla hay ahora y después. Se puede **marcar el camino en el suelo** o pedir **«Llevarme»** para ir caminando solo.
- **Minimapa** arriba a la derecha, con tu posición y las puertas.
- **Sala**: al entrar, tu personaje camina hasta un asiento libre y se sienta. Después aparece la pantalla del ponente, y abajo se ve el público con globos de chat y reacciones. El auditorio principal es más grande, con escenario amplio y pantallas de patrocinadores enormes.
- **Moverse e interactuar**: flechas o WASD, o clic en el piso. X para hablar o usar un directorio, y teclas 1 a 5 para reaccionar (👋 👏 ❤️ 😂 🎉).
- **Ponente**: dentro de su sala usa «¿Eres el ponente?» con su código y su personaje pasa al atril. Desde ahí puede:
  - transmitir su **voz**, su **pantalla** o su **cámara** en vivo (WebRTC);
  - subir un **PDF** y pasar las diapositivas;
  - pegar un enlace de **YouTube Live o Vimeo**.

## Eventos de ejemplo

| Número | Evento | Temática | Acceso |
| --- | --- | --- | --- |
| 101 | MyConferences Tech Summit (auditorio + 10 salas, en dos pisos) | Tecnológica | Abierto |
| 202 | Stellar Builders Day (auditorio + 8 salas) | Medieval | Privado |
| 303 | Demo Day · Inversores (auditorio + 8 salas) | Minimalista | Privado |

Se definen en `server/src/seed.ts`. Sus patrocinadores son marcas ficticias con logos de ejemplo en `server/assets/logos`. La gente que conversa en los pasillos es decorativa: da ambiente y no son personas conectadas.

## Cómo correrlo

Requiere Node 20 o superior.

```bash
npm install
npm run dev
```

Abre http://localhost:5173. Al arrancar, el servidor muestra en la terminal las salas, cuántos invitados tiene cada una privada y el **código de ponente** de cada sala.

Para probar con varias personas, abre la app en otra ventana o en modo incógnito.

### Listas de invitados de los eventos de ejemplo

Los eventos que crean las empresas manejan su lista desde el panel. Para los de ejemplo hay dos formas de cargarla y se pueden usar juntas:

- Un archivo `server/data/whitelists.json`:

  ```json
  { "202": ["ana@ejemplo.com", "luis@ejemplo.com"], "303": ["inversora@ejemplo.com"] }
  ```

- La variable `VENUE_WHITELISTS`:

  ```bash
  VENUE_WHITELISTS="202:ana@ejemplo.com|luis@ejemplo.com;303:inversora@ejemplo.com" npm run dev
  ```

Las listas se leen al arrancar el servidor.

### Producción

```bash
npm run build   # compila el cliente en client/dist
npm start       # el servidor sirve la app y el tiempo real en el puerto 3001
```

Variables de entorno:

| Variable | Para qué sirve |
| --- | --- |
| `PORT` | Puerto del servidor (por defecto `3001`). |
| `EVENT_NAME` | Nombre del evento de ejemplo 101. |
| `VENUE_WHITELISTS` | Correos invitados a los eventos de ejemplo privados (ver arriba). |
| `SPEAKER_CODES` | Códigos fijos de ponente, por ejemplo `101/stellar:ABC123,202/soroban:XYZ789`. Las salas sin código fijo reciben uno aleatorio al arrancar. |
| `SESSION_SECRET` | Clave para firmar las sesiones. Si no se define, se genera una y se guarda en `server/data/accounts.json`. |
| `DATA_DIR` | Carpeta de las cuentas, los eventos de las empresas y las listas de invitados (por defecto `server/data`). |

Se puede desplegar en cualquier servicio que soporte WebSockets, como Render, Railway o Fly.io. Las carpetas `server/data` (cuentas y eventos) y `server/uploads` (logos y PDF) tienen que estar en un disco persistente.

## Estructura

```
shared/types.ts      Tipos y eventos de Socket.IO compartidos
shared/maps.ts       Mapas: recepción, recinto del evento, salas y auditorio (los usan cliente y servidor)
shared/themes.ts     Temáticas de evento, colores de sala y reacciones
server/src/events.ts Eventos creados por las empresas (archivo JSON)
shared/look.ts       Paletas del personaje y validación
server/src/seed.ts   Eventos de ejemplo: salas, agenda, patrocinadores y listas de invitados
server/src/accounts.ts  Cuentas (archivo JSON, contraseñas con scrypt, sesiones firmadas)
server/src/index.ts  Servidor Express + Socket.IO y API del panel de empresa
client/src/world.ts  Dibujo por temática (pisos, muros, puertas, marquesina, muebles, pantallas) y búsqueda de caminos
client/src/avatar.ts Personaje de bloques visto desde arriba
client/src/Scene.tsx Mapa interactivo: caminar, sentarse, directorios, camino guiado, minimapa, globos y reacciones
client/src/live.ts   Transmisión en vivo del ponente por WebRTC
client/src/          Reception, Hall, RoomView, CompanyPanel, AvatarEditor, AuthDialog, Agenda
```

## Limitaciones actuales

- La transmisión en vivo va directo del ponente a cada asistente. Funciona bien con decenas de personas por sala. Para cientos habría que pasar por un servidor de medios (SFU), por ejemplo LiveKit.
- Solo se usan servidores STUN públicos. En redes corporativas muy cerradas hace falta además un servidor TURN.
- El chat, las preguntas y las diapositivas viven en memoria: se pierden si el servidor se reinicia. Las cuentas sí se guardan.
- El cobro a las empresas todavía no está integrado: cualquiera puede crear una cuenta de empresa. El siguiente paso es conectar un medio de pago (por ejemplo Stripe) y activar la cuenta al pagar.
- Cada evento tiene el auditorio y entre 8 y 16 salas. En el piso de arriba, los puestos sin sala muestran un cuadro en el muro.
- La agenda se genera alrededor de la hora en que arranca el servidor, para que siempre haya algo en vivo durante la demo.
