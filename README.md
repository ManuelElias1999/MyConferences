# MyConferences

Plataforma de eventos online al estilo Gather, pensada sobre todo para charlas de tecnología. Las empresas crean sus eventos privados con el estilo que quieran y con los logos de sus patrocinadores. Los asistentes llegan a una recepción tipo cowork, le dicen a la recepcionista el número del evento y entran al lugar de esa empresa. Ahí cruzan la puerta de la charla que quieran; al entrar, su personaje va hasta un asiento libre, se sienta y ven lo que comparte el ponente mientras lo escuchan.

## Cómo funciona

### Para las empresas

- Se registran con una **cuenta de empresa** (en «Crear cuenta», marcando «Es una cuenta de empresa»).
- Desde el **Panel de empresa** crean y editan sus eventos:
  - nombre y descripción;
  - **estilo del lugar**: tecnológico, minimalista, rústico, medieval o jardín, con vista previa;
  - **acceso**: privado (solo los correos de la lista) o abierto;
  - **salas de charla** (hasta 12), cada una con su color y su **código de ponente**;
  - **patrocinadores**: suben el logo (PNG, JPG o WebP) y opcionalmente su sitio web. Los logos rotan en la pantalla grande del lugar, en los tótems y en las pantallas a los lados de cada sala.
- Cada evento recibe un **número** para compartir con los invitados. La empresa siempre puede entrar a su propio evento con «Visitar mi evento», y también puede cerrarlo: quien esté dentro vuelve a recepción.

### Para los asistentes

- **Recepción**: es la primera pantalla, un cowork tecnológico pequeño. Sin cuenta entras como invitado con el personaje por defecto; con cuenta apareces con tu personaje personalizado (peinado, colores de pelo, piel, polera, pantalón y zapatos).
- **Recepcionista**: está a pocos pasos. Te acercas y pulsas X (o le haces clic), y ella te pide el número del evento. Los eventos privados piden iniciar sesión y revisan que tu correo esté en la lista de invitados.
- **Lugar del evento**: decorado con el estilo que eligió la empresa. Las puertas de las salas están en el muro del fondo, con una etiqueta pequeña que dice si hay una charla en vivo y cuántas personas hay dentro. Si el evento tiene más de cuatro salas, una escalera lleva a los pisos de arriba. Las puertas de vidrio te devuelven a recepción.
- **Sala**: al entrar, tu personaje camina desde la puerta hasta un asiento libre y se sienta. Después aparece la pantalla del ponente, y abajo se ve el público con globos de chat y reacciones. A la derecha están el chat, las preguntas con votos y la lista de asistentes.
- **Moverse e interactuar**: flechas o WASD, o clic en el piso (se ve el camino que vas a recorrer). Pulsa X para hablar con la recepcionista y las teclas 1 a 5 para reaccionar (👋 👏 ❤️ 😂 🎉).
- **Ponente**: dentro de su sala usa «¿Eres el ponente?» con su código y su personaje pasa al atril. Desde ahí puede:
  - transmitir su **voz**, su **pantalla** o su **cámara** en vivo (WebRTC);
  - subir un **PDF** y pasar las diapositivas;
  - pegar un enlace de **YouTube Live o Vimeo**.

## Eventos de ejemplo

| Número | Evento | Estilo | Acceso |
| --- | --- | --- | --- |
| 101 | MyConferences Tech Summit (6 salas en 2 pisos) | Tecnológico | Abierto |
| 202 | Stellar Builders Day (4 salas) | Medieval | Privado |
| 303 | Demo Day · Inversores (2 salas) | Minimalista | Privado |

Se definen en `server/src/seed.ts`. Sus patrocinadores son marcas ficticias con logos de ejemplo en `server/assets/logos`.

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
shared/maps.ts       Mapas: recepción, pisos del edificio y salas por estilo (los usan cliente y servidor)
shared/themes.ts     Estilos de evento, colores de sala y reacciones
server/src/events.ts Eventos creados por las empresas (archivo JSON)
shared/look.ts       Paletas del personaje y validación
server/src/seed.ts   Eventos de ejemplo: salas, agenda, patrocinadores y listas de invitados
server/src/accounts.ts  Cuentas (archivo JSON, contraseñas con scrypt, sesiones firmadas)
server/src/index.ts  Servidor Express + Socket.IO y API del panel de empresa
client/src/world.ts  Dibujo de los mapas por estilo (pisos, muros, puertas, escaleras, muebles) y búsqueda de caminos
client/src/avatar.ts Personaje pixel-art visto desde arriba
client/src/Scene.tsx Mapa interactivo: caminar con teclado o clic, sentarse, interactuar con X, globos de chat
client/src/live.ts   Transmisión en vivo del ponente por WebRTC
client/src/          Reception, Hall, RoomView, CompanyPanel, AvatarEditor, AuthDialog, Agenda
```

## Limitaciones actuales

- La transmisión en vivo va directo del ponente a cada asistente. Funciona bien con decenas de personas por sala. Para cientos habría que pasar por un servidor de medios (SFU), por ejemplo LiveKit.
- Solo se usan servidores STUN públicos. En redes corporativas muy cerradas hace falta además un servidor TURN.
- El chat, las preguntas y las diapositivas viven en memoria: se pierden si el servidor se reinicia. Las cuentas sí se guardan.
- El cobro a las empresas todavía no está integrado: cualquiera puede crear una cuenta de empresa. El siguiente paso es conectar un medio de pago (por ejemplo Stripe) y activar la cuenta al pagar.
- Los eventos de las empresas aún no tienen agenda con horarios: cada sala muestra su tema. Los de ejemplo sí la tienen.
- La agenda se genera alrededor de la hora en que arranca el servidor, para que siempre haya algo en vivo durante la demo.
