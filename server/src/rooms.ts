// Salas creadas por los usuarios, guardadas en un archivo JSON para que
// sobrevivan a un reinicio del servidor.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Room } from "../../shared/types.ts";

export interface CreatedRoom {
  venueId: string;
  room: Room;
  speakerCode: string;
  ownerId: string;
  createdAt: number;
}

export function createRoomStore(dataDir: string) {
  mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "rooms.json");
  const rooms: CreatedRoom[] = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as CreatedRoom[]) : [];

  let writing = Promise.resolve();
  const persist = () => {
    writing = writing.then(async () => {
      const tmp = `${file}.tmp`;
      await writeFile(tmp, JSON.stringify(rooms, null, 2));
      await rename(tmp, file);
    });
    return writing;
  };

  return {
    list: () => rooms,
    countByOwner: (ownerId: string) => rooms.filter((r) => r.ownerId === ownerId).length,
    async add(entry: CreatedRoom) {
      rooms.push(entry);
      await persist();
    },
  };
}
