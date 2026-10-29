// Felles hjelpere for verktøyene.
import fs from 'node:fs';
import path from 'node:path';

export const DATA = path.join(import.meta.dirname, '..', '..', 'data');
export const lesJson = (fil) => JSON.parse(fs.readFileSync(path.join(DATA, fil), 'utf8'));

// Godtar full ISO-tid eller bare "03:10" (tolkes som natt til 29. okt 2026, norsk tid).
export function tilMs(tid) {
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(tid)) tid = `2026-10-29T${tid.padStart(5, '0')}+01:00`;
  const ms = Date.parse(tid);
  if (Number.isNaN(ms)) throw new Error(`Skjønner ikke tidspunktet «${tid}». Bruk f.eks. "03:10" eller "2026-10-29T03:10:00+01:00".`);
  return ms;
}
