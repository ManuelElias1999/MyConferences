// Eventos creados por empresas, guardados en un archivo JSON para que
// sobrevivan a un reinicio del servidor.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Venue } from "../../shared/types.ts";

export interface StoredEvent {
  ownerId: string;
  venue: Venue;
  whitelist: string[];
  /** Código de ponente de cada sala. */
  speakerCodes: Record<string, string>;
  createdAt: number;
  /** Correos del equipo organizador y de los mentores. */
  staff?: string[];
  mentors?: string[];
}

export function createEventStore(dataDir: string) {
  mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "events.json");
  const events: StoredEvent[] = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as StoredEvent[]) : [];

  let writing = Promise.resolve();
  const persist = () => {
    writing = writing.then(async () => {
      const tmp = `${file}.tmp`;
      await writeFile(tmp, JSON.stringify(events, null, 2));
      await rename(tmp, file);
    });
    return writing;
  };

  return {
    list: () => events,
    get: (venueId: string) => events.find((e) => e.venue.id === venueId) ?? null,
    async save(entry: StoredEvent) {
      const i = events.findIndex((e) => e.venue.id === entry.venue.id);
      if (i >= 0) events[i] = entry;
      else events.push(entry);
      await persist();
    },
    async remove(venueId: string) {
      const i = events.findIndex((e) => e.venue.id === venueId);
      if (i >= 0) events.splice(i, 1);
      await persist();
    },
  };
}
