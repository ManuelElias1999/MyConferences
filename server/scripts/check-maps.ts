// Revisa los planos de todas las temáticas: puertas, escaleras y zonas alcanzables, techos, stands y adornos.
// Uso: npm run check:maps
import { checkVenue, maxRoomsFor, venueFloors } from "../../shared/maps.ts";
import { THEMES } from "../../shared/themes.ts";

const sponsors = Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, name: `S${i}`, logoUrl: "", url: null, pitch: "" }));
const stands = [...sponsors, { id: "o", name: "Organizador", logoUrl: "", url: null, pitch: "", organizer: true }];
let failed = 0;
for (const { id } of THEMES) {
  for (const capacity of id === "hackathon" ? [100, 300, 500] : [100]) {
    const rooms = Array.from({ length: maxRoomsFor(id) }, (_, i) => ({ id: `r${i}`, name: i ? `Sala ${i}` : "Auditorio", color: "#ff5c39", main: i === 0 }));
    venueFloors(id, rooms, stands, capacity).forEach((map, floor) => {
      const problems = checkVenue(map);
      if (problems.length) failed++;
      console.log(`${id} ${capacity} piso ${floor} (${map.floorName}, ${map.w}×${map.h}, ${map.doors.length} puertas):`, problems.length ? problems : "ok");
    });
  }
}
process.exit(failed ? 1 : 0);
