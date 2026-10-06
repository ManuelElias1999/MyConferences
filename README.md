# MyConferences

Plataforma de eventos online que se recorre como un lugar. Entras por la recepción, caminas por un salón en 2D, ves qué charlas están en vivo y entras a la sala que quieras. Cada sala tiene su presentación, chat, preguntas y lista de asistentes, y puedes cambiar de sala cuando quieras.

## Qué incluye esta versión

- **Recepción**: creas tu credencial (nombre, rol y color de avatar) y ves la agenda del día.
- **Salón principal**: mapa 2D compartido en tiempo real. Te mueves con las flechas, con WASD o haciendo clic, y entras a una sala pisando su puerta o haciendo clic en ella. Al lado ves qué hay en vivo, lo próximo y quién está conectado.
- **Salas simultáneas**: cuatro salas de ejemplo (Auditorio, Stellar, IA y Startups), cada una con su propia agenda.
- **Presentación en vivo**: el expositor sube un PDF y pasa las diapositivas (con botones o con las flechas), y todos en la sala ven la misma. También puede pegar un enlace de YouTube Live o Vimeo para transmitir video y alternar entre video y diapositivas.
- **Chat** por sala.
- **Preguntas** con votos: las más votadas suben y el expositor las marca como respondidas.
- **Agenda** con el estado de cada charla (en vivo, próxima, terminó) y acceso directo a la sala.

Más adelante: zona de networking con audio y video, stands virtuales y avatares personalizados. En el mapa ya están reservados sus espacios.

## Cómo correrlo

Requiere Node 20 o superior.

```bash
npm install
npm run dev
```

Abre http://localhost:5173. Al arrancar, el servidor muestra en la terminal un **código de expositor por sala**. Para presentar, entra con «¿Vas a presentar?» y usa el código de la sala que te toca.

Para probar con varias personas, abre la app en otra ventana o en modo incógnito.

### Producción

```bash
npm run build   # compila el cliente en client/dist
npm start       # el servidor sirve la app y el tiempo real en el puerto 3001
```

Variables de entorno:

| Variable | Para qué sirve |
| --- | --- |
| `PORT` | Puerto del servidor (por defecto `3001`). |
| `EVENT_NAME` | Nombre del evento. |
| `SPEAKER_CODES` | Códigos fijos de expositor, por ejemplo `stellar:ABC123,ia:XYZ789`. Las salas sin código fijo reciben uno aleatorio al arrancar. |

Se puede desplegar en cualquier servicio que soporte WebSockets, como Render, Railway o Fly.io.

## Estructura

```
shared/types.ts     Tipos y eventos de Socket.IO compartidos
server/src/seed.ts  Salas, mapa y agenda del evento de ejemplo
server/src/index.ts Servidor Express + Socket.IO (estado en memoria, subida de PDFs)
client/src/         App React: Reception, Hall (mapa en canvas), RoomView, Agenda, SlideViewer
```

## Limitaciones actuales

- El estado vive en memoria: si el servidor se reinicia se pierden el chat, las preguntas y las diapositivas subidas, y los códigos de expositor aleatorios cambian.
- Hay un solo evento, definido en `server/src/seed.ts`. Su agenda se genera alrededor de la hora en que arranca el servidor, para que siempre haya algo en vivo durante la demo.
- No hay cuentas ni moderación del chat.
