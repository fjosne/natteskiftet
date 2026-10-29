import { lesJson, tilMs } from './felles.js';

function sokILogger({ tjeneste, niva, fra, til, tekst, maks = 50 } = {}, kontekst = {}) {
  const fraMs = fra ? tilMs(fra) : -Infinity;
  // Loggene kappes ved alarmtidspunktet: øvre grense er min(til, nå).
  const tilMsVerdi = Math.min(til ? tilMs(til) : Infinity, kontekst.nå ?? Infinity);
  const logger = lesJson('logger.json');
  const kjente = [...new Set(logger.map((l) => l.tjeneste))];
  if (tjeneste && !kjente.includes(tjeneste)) throw new Error(`Ukjent tjeneste «${tjeneste}». Gyldige: ${kjente.join(', ')}`);
  const treff = logger.filter((l) =>
    (!tjeneste || l.tjeneste === tjeneste) &&
    (!niva || l.nivå === niva.toUpperCase()) &&
    (!tekst || l.melding.toLowerCase().includes(tekst.toLowerCase())) &&
    Date.parse(l.tid) >= fraMs && Date.parse(l.tid) <= tilMsVerdi);

  const grense = Math.min(Math.max(Number(maks) || 50, 1), 200);
  if (treff.length === 0) return 'Ingen logglinjer matchet filteret. Prøv et bredere søk.';
  const linjer = treff.slice(0, grense).map((l) => `${l.tid} ${l.tjeneste} ${l.nivå} ${l.melding}`);
  if (treff.length > grense) linjer.push(`... ${treff.length - grense} linjer til. Snevre inn søket eller øk maks.`);
  return linjer.join('\n');
}

export default {
  definisjon: {
    name: 'sok_i_logger',
    description:
      'Søker i loggene fra natt til 29. oktober 2026 (ca 02:30-03:50). Alle filtre er valgfrie og kan kombineres. ' +
      'Tjenester: api-gateway, innlogging, betaling, sok, varsling, kunde-db. ' +
      'Start gjerne bredt (én tjeneste, et tidsvindu rundt alarmen) og snevre inn med tekst når du ser noe interessant. ' +
      'Loggene går bare til alarmtidspunktet. ' +
      'Husk at feilen ofte sitter i en annen tjeneste enn den som alarmerer.',
    input_schema: {
      type: 'object',
      properties: {
        tjeneste: { type: 'string', description: 'Tjenestenavn, f.eks. "betaling".' },
        niva: { type: 'string', enum: ['INFO', 'WARN', 'ERROR'], description: 'Bare linjer med dette nivået.' },
        fra: { type: 'string', description: 'Fra og med tidspunkt, "03:00" eller full ISO-tid.' },
        til: { type: 'string', description: 'Til og med tidspunkt, "03:15" eller full ISO-tid.' },
        tekst: { type: 'string', description: 'Tekst som må finnes i meldingen (ikke skille på store/små bokstaver).' },
        maks: { type: 'number', description: 'Maks antall linjer tilbake. Standard 50, høyst 200.' },
      },
    },
  },
  kjør: async (input, kontekst) => sokILogger(input, kontekst),
};
