import { lesJson } from './felles.js';

const rød = (t) => `\x1b[31m${t}\x1b[0m`;
const grå = (t) => `\x1b[90m${t}\x1b[0m`;

// Finner vakten for et team: primær, ellers sekundær. Tar tjenestelista som
// argument så den kan testes uten å røre data/tjenester.json.
export function finnVakt(team, tjenester) {
  const gyldige = [...new Set(tjenester.map((t) => t.eier_team))];
  const tjeneste = tjenester.find((t) => t.eier_team === team);
  if (!tjeneste) throw new Error(`Ukjent team «${team}». Gyldige team: ${gyldige.join(', ')}`);
  const person = tjeneste.vakt?.primær || tjeneste.vakt?.sekundær;
  if (!person) throw new Error(`Team «${team}» har verken primær- eller sekundærvakt.`);
  return { team, person, rolle: tjeneste.vakt?.primær ? 'primær' : 'sekundær' };
}

export function varsleVakt({ til, kopi = [], melding } = {}, kontekst, tjenester = lesJson('tjenester.json')) {
  if (typeof melding !== 'string' || !melding.trim()) throw new Error('Meldingen mangler. Skriv en kort rapport om hva som er galt og mulige tiltak.');
  const kopiListe = Array.isArray(kopi) ? kopi : [kopi];
  // Slå opp alt før noe «sendes», så et ukjent team ikke gir et halvt varsel.
  const mottaker = finnVakt(til, tjenester);
  const kopiMottakere = [...new Set(kopiListe)].filter((t) => t !== til).map((t) => finnVakt(t, tjenester));

  console.log(`  ${rød('SIMULERT')} varsel til ${mottaker.team} (${mottaker.person}, ${mottaker.rolle}vakt)`);
  if (kopiMottakere.length) console.log(`  kopi: ${kopiMottakere.map((k) => `${k.team} (${k.person})`).join(', ')}`);
  console.log(grå(`  melding: ${melding}`));

  const alle = [mottaker, ...kopiMottakere];
  if (kontekst?.varslet) for (const { team } of alle) if (!kontekst.varslet.includes(team)) kontekst.varslet.push(team);
  return `SIMULERT: varsel «sendt» til ${alle.map((m, i) => `${m.team} (${m.person}, ${m.rolle}vakt)${i === 0 ? '' : ' i kopi'}`).join('; ')}.`;
}

export default {
  definisjon: {
    name: 'varsle_vakt',
    description:
      'Varsler vakthavende (simulert) med en kort rapport om hva som er galt og mulige tiltak. ' +
      'Når skal du varsle: alarmer med alvorlighet «kritisk» varsler alltid, også etter vellykket tiltak. Andre alarmer varsler bare ved usikkerhet ' +
      '(usikker årsak, tiltak ikke utført eller ikke tillatt, eller bare delvis demping). Falsk alarm gir ingen varsling. ' +
      'Hvem: teamet som eier årsaken får varselet (til), teamet som alarmerer settes i kopi, og Team Nøkkelknippe tas med i kopi i tillegg hvis engangskoder er rammet. ' +
      'Bruk eier_team fra hent_tjenesteinfo som teamnavn, f.eks. «Team Grunnmur». Primærvakt brukes, sekundær hvis primær mangler.',
    input_schema: {
      type: 'object',
      properties: {
        til: { type: 'string', description: 'Eier-teamet til tjenesten som har årsaken, f.eks. "Team Grunnmur".' },
        kopi: { type: 'array', items: { type: 'string' }, description: 'Team som får varselet i kopi, f.eks. alarmerende team.' },
        melding: { type: 'string', description: 'Kort rapport: hva som er galt (observert vs. antatt) og mulige tiltak.' },
      },
      required: ['til', 'melding'],
    },
  },
  kjør: async (input, kontekst) => varsleVakt(input, kontekst),
};
