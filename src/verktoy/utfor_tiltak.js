const rød = (t) => `\x1b[31m${t}\x1b[0m`;
const gul = (t) => `\x1b[33m${t}\x1b[0m`;

// Tillatte tiltak (BS-07): hvert tiltak hører til én tjeneste og én kommando.
const TILTAK = {
  rollback_betaling: { tjeneste: 'betaling', kommando: 'deploy rollback betaling' },
  pause_reindeks_sok: { tjeneste: 'sok', kommando: 'sokctl reindeks pause produkter-v7' },
  pause_leveringsvarsler: { tjeneste: 'varsling', kommando: 'varslingctl pause mal=leveringsvarsel' },
};

function utforTiltak({ tiltak, begrunnelse } = {}, kontekst) {
  const gyldige = Object.keys(TILTAK);
  if (!gyldige.includes(tiltak)) throw new Error(`Tiltaket «${tiltak}» er ikke tillatt. Gyldige tiltak: ${gyldige.join(', ')}. Alt annet er forbudt. Varsle vakt i stedet.`);
  if (typeof begrunnelse !== 'string' || !begrunnelse.trim()) throw new Error('Begrunnelse mangler. Oppgi hvilke vilkår i runbooken som er oppfylt.');

  const { tjeneste, kommando } = TILTAK[tiltak];
  if (!kontekst?.hentedeRunbooks?.has(tjeneste)) {
    throw new Error(`Runbooken for ${tjeneste} må hentes med hent_runbook («${tjeneste}») før tiltaket «${tiltak}» kan utføres.`);
  }

  console.log(`  ${rød('SIMULERT')} ${gul(`$ ${kommando}`)} (tiltak: ${tiltak})`);
  console.log(`  begrunnelse: ${begrunnelse}`);
  return `SIMULERT: tiltaket «${tiltak}» ble ikke kjørt på ekte, bare simulert (kommando: ${kommando}). Effekten kan ikke verifiseres. Rapporten må si at tiltaket er simulert og at effekten er ukjent.`;
}

export default {
  definisjon: {
    name: 'utfor_tiltak',
    description:
      'Utfører (simulerer) ett tiltak fra runbooken. Tillatte tiltak: rollback_betaling (betaling), pause_reindeks_sok (sok), pause_leveringsvarsler (varsling). ' +
      'Alt annet er forbudt, blant annet sletting av loggarkiver (kan ikke angres) og restart av pgbouncer (utdatert). ' +
      'Bruk det bare når ALLE tre vilkår er oppfylt: (1) runbooken er fersk og stemmer med det du ser i loggene, ' +
      '(2) symptomene og tidspunktet for endringen matcher runbookens beskrivelse, (3) tiltaket kan reverseres. ' +
      'Runbooken for tiltakets tjeneste må være hentet med hent_runbook først, ellers avvises kallet. ' +
      'Er et vilkår ikke oppfylt, eller er du usikker, skal du ikke utføre tiltaket, men varsle vakt med varsle_vakt. ' +
      'Effekten kan ikke verifiseres etterpå, så rapporten må si at tiltaket er simulert.',
    input_schema: {
      type: 'object',
      properties: {
        tiltak: { type: 'string', enum: Object.keys(TILTAK), description: 'Hvilket tiltak som skal utføres.' },
        begrunnelse: { type: 'string', description: 'Hvilke vilkår i runbooken som er oppfylt, med belegg fra loggene.' },
      },
      required: ['tiltak', 'begrunnelse'],
    },
  },
  kjør: async (input, kontekst) => utforTiltak(input, kontekst),
};
