// Alarminput: gjør argumentet fra kommandolinja om til oppgavetekst, «nå» og alarmobjekt.
import { lesJson, tilMs } from './verktoy/felles.js';

const hhmm = (ms) => new Date(ms).toLocaleTimeString('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');

// Ser teksten ut som en alarm-ID (ALARM-xxxx)?
export const erAlarmId = (tekst) => /^ALARM-\w+$/i.test(tekst.trim());

export function hentAlarm(id) {
  const alarmer = lesJson('alarmer.json');
  const alarm = alarmer.find((a) => a.id.toLowerCase() === id.trim().toLowerCase());
  if (!alarm) throw new Error(`Ukjent alarm «${id}». Gyldige ID-er: ${alarmer.map((a) => a.id).join(', ')}`);
  return alarm;
}

// Første klokkeslett i teksten: «kl 03:40», «kl. 3.40» eller bare «03:40». Gir "HH:MM" eller null.
export function finnKlokkeslett(tekst) {
  const m = tekst.match(/\bkl\.?\s*(\d{1,2})[:.](\d{2})\b/i) ?? tekst.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

// Første kjente tjeneste som nevnes i teksten, ellers null.
function finnTjeneste(tekst) {
  const kjente = [...new Set(lesJson('logger.json').map((l) => l.tjeneste))];
  const tekstUtenSøk = tekst.replace(/søk/gi, 'sok');
  return kjente.find((t) => new RegExp(`(^|[^\\p{L}\\p{N}-])${t}($|[^\\p{L}\\p{N}-])`, 'iu').test(tekstUtenSøk)) ?? null;
}

// Tidspunktet på siste logglinje (ms).
const sisteLoggMs = () => Math.max(...lesJson('logger.json').map((l) => Date.parse(l.tid)));

// Returnerer { oppgave, nå, alarm, merknad }. Kaster Error med gyldige ID-er for ukjent alarm-ID.
// merknad er en linje som skrives ut til brukeren, eller null.
export function lagAlarmInput(arg) {
  if (erAlarmId(arg)) {
    const alarm = hentAlarm(arg);
    const oppgave =
      `${alarm.id} kl ${hhmm(Date.parse(alarm.tid))} natt til 29. oktober. ` +
      `Alvorlighet: ${alarm.alvorlighet}. Tjeneste: ${alarm.tjeneste}. ` +
      `${alarm.tittel}: ${alarm.tekst}`;
    return { oppgave, nå: Date.parse(alarm.tid), alarm, merknad: null };
  }

  const klokkeslett = finnKlokkeslett(arg);
  const nå = klokkeslett ? tilMs(klokkeslett) : sisteLoggMs();
  const alarm = { id: null, tid: `2026-10-29T${hhmm(nå)}:${String(new Date(nå).getUTCSeconds()).padStart(2, '0')}+01:00`, tjeneste: finnTjeneste(arg), alvorlighet: null, tekst: arg };
  let oppgave = `${arg}\nAlvorlighet er ikke oppgitt for denne alarmen (fritekst).`;
  let merknad = null;
  if (!klokkeslett) {
    merknad = `Klokkeslett ikke oppgitt, bruker siste logglinje kl ${hhmm(nå)} som nå.`;
    oppgave += `\n${merknad}`;
  }
  return { oppgave, nå, alarm, merknad };
}
