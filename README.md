# MyConferences

Plataforma de eventos online al estilo Gather, pensada sobre todo para charlas de tecnología. Apareces en la recepción de un cowork con tu personaje, le pides a la recepcionista el número de tu sala y ella te lleva a un edificio con salas a la izquierda, a la derecha y en los pisos de arriba. Cruzas la puerta de la charla que quieras y, al entrar, tu personaje va hasta un asiento libre, se sienta y ves lo que comparte el ponente mientras lo escuchas.

## Cómo funciona

- **Recepción**: es la primera pantalla, un cowork tecnológico con escritorios y monitores, sala de estar, barra de café, ping-pong y un letrero de neón. Sin cuenta entras como invitado con el personaje por defecto; con cuenta apareces con tu personaje personalizado. Se camina con las flechas o WASD, o haciendo clic en el piso, y lo que escribes en la barra de abajo aparece en un globo sobre tu personaje.
- **Cuentas y personaje**: te registras con correo y contraseña y eliges peinado, colores de pelo, piel, polera, pantalón y zapatos. La sesión se recuerda en el navegador.
- **Recepcionista**: te acercas al mostrador y pulsas X (o le haces clic) y ella te pregunta el número de sala.
  - Las salas abiertas aceptan a cualquiera, también a los invitados.
  - Las salas privadas piden iniciar sesión y revisan que el correo de tu cuenta esté en su lista de invitados.
- **Edificio**: cada número de sala es un edificio. En la planta baja hay salas a tu izquierda y a tu derecha, y una escalera sube a los pisos de arriba, que tienen más salas. Cada puerta tiene el estilo de su sala y una placa que indica si hay una charla en vivo y cuántas personas hay dentro. El panel lateral lista las salas por piso. Las puertas de vidrio del fondo te devuelven a recepción.
- **Estilos de sala**: tecnológica, minimalista, rústica, medieval y jardín. Cada uno tiene su piso, sus paredes y su decoración.
- **Crear una sala**: con una cuenta, desde el panel del edificio («＋ Crear sala») eliges nombre, tema, estilo y color, con una vista previa de cada estilo. La sala aparece en el siguiente lugar libre del edificio (o en un piso nuevo), se guarda en `server/data/rooms.json` y te da un código de ponente. Al entrar, quedas como ponente automáticamente.
- **Sala**: al entrar, tu personaje camina desde la puerta hasta un asiento libre y se sienta. Después aparece la pantalla del ponente, y abajo se ve el público sentado con globos de chat. A la derecha están el chat, las preguntas con votos y la lista de asistentes.
- **Ponente**: dentro de su sala usa «¿Eres el ponente?» con su código y su personaje pasa al atril. Desde ahí puede:
  - transmitir su **voz**, su **pantalla** o su **cámara** en vivo (WebRTC);
  - subir un **PDF** y pasar las diapositivas;
  - pegar un enlace de **YouTube Live o Vimeo**.

## Salas de ejemplo

| Número | Salón | Acceso |
| --- | --- | --- |
| 101 | MyConferences Tech Summit (6 salas en 2 pisos) | Abierta |
| 202 | Stellar Builders Day (4 salas) | Privada |
| 303 | Demo Day · Inversores (2 salas) | Privada |

Se definen en `server/src/seed.ts`.

## Cómo correrlo

Requiere Node 20 o superior.

```bash
npm install
npm run dev
```

Abre http://localhost:5173. Al arrancar, el servidor muestra en la terminal las salas, cuántos invitados tiene cada una privada y el **código de ponente** de cada sala.

Para probar con varias personas, abre la app en otra ventana o en modo incógnito.

### Listas de invitados de las salas privadas

Hay dos formas de cargarlas y se pueden usar juntas:

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
| `EVENT_NAME` | Nombre del salón 101. |
| `VENUE_WHITELISTS` | Correos invitados a cada sala privada (ver arriba). |
| `SPEAKER_CODES` | Códigos fijos de ponente, por ejemplo `101/stellar:ABC123,202/soroban:XYZ789`. Las salas sin código fijo reciben uno aleatorio al arrancar. |
| `SESSION_SECRET` | Clave para firmar las sesiones. Si no se define, se genera una y se guarda en `server/data/accounts.json`. |
| `DATA_DIR` | Carpeta de las cuentas y las listas de invitados (por defecto `server/data`). |

Se puede desplegar en cualquier servicio que soporte WebSockets, como Render, Railway o Fly.io. La carpeta `server/data` tiene que estar en un disco persistente para no perder las cuentas.

## Estructura

```
shared/types.ts      Tipos y eventos de Socket.IO compartidos
shared/maps.ts       Mapas: recepción, pisos del edificio y salas por estilo (los usan cliente y servidor)
shared/themes.ts     Estilos de sala y colores disponibles
server/src/rooms.ts  Salas creadas por los usuarios (archivo JSON)
shared/look.ts       Paletas del personaje y validación
server/src/seed.ts   Salones, salas, agenda y listas de invitados
server/src/accounts.ts  Cuentas (archivo JSON, contraseñas con scrypt, sesiones firmadas)
server/src/index.ts  Servidor Express + Socket.IO
client/src/world.ts  Dibujo de los mapas por estilo (pisos, muros, puertas, escaleras, muebles) y búsqueda de caminos
client/src/avatar.ts Personaje pixel-art visto desde arriba
client/src/Scene.tsx Mapa interactivo: caminar con teclado o clic, sentarse, interactuar con X, globos de chat
client/src/live.ts   Transmisión en vivo del ponente por WebRTC
client/src/          Reception, Hall, RoomView, CreateRoom, AvatarEditor, AuthDialog, Agenda
```

## Limitaciones actuales

- La transmisión en vivo va directo del ponente a cada asistente. Funciona bien con decenas de personas por sala. Para cientos habría que pasar por un servidor de medios (SFU), por ejemplo LiveKit.
- Solo se usan servidores STUN públicos. En redes corporativas muy cerradas hace falta además un servidor TURN.
- El chat, las preguntas y las diapositivas viven en memoria: se pierden si el servidor se reinicia. Las cuentas sí se guardan.
- No hay panel de administración. Las salas del programa, la agenda y las listas de invitados se editan en archivos. Las salas creadas por usuarios todavía no se pueden editar ni borrar desde la app.
- La agenda se genera alrededor de la hora en que arranca el servidor, para que siempre haya algo en vivo durante la demo.
