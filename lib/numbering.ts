// Canonical sequential numbering — HC certificates and application refs.
// Uses an atomic counter row per key so numbers never collide.
import { prisma } from "@/lib/db";

async function nextSequence(key: string): Promise<number> {
  const counter = await prisma.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

/** e.g. HC-2026-000123 */
export async function nextHcNumber(date: Date = new Date()): Promise<string> {
  const year = date.getFullYear();
  const seq = await nextSequence(`HC-${year}`);
  return `HC-${year}-${String(seq).padStart(6, "0")}`;
}

/** e.g. CAAB/HC/2026/VGHS/0042 */
export async function nextApplicationRef(
  icao: string,
  date: Date = new Date()
): Promise<string> {
  const year = date.getFullYear();
  const seq = await nextSequence(`APP-${year}-${icao}`);
  return `CAAB/HC/${year}/${icao}/${String(seq).padStart(4, "0")}`;
}
