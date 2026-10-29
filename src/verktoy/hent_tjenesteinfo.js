import { lesJson } from './felles.js';

function hentTjenesteinfo({ tjeneste } = {}) {
  const tjenester = lesJson('tjenester.json');
  const navn = tjenester.map((t) => t.navn);
  const t = tjenester.find((x) => x.navn === tjeneste);
  if (!t) throw new Error(`Ukjent tjeneste «${tjeneste}». Gyldige: ${navn.join(', ')}`);

  // Omvendt oppslag: hvem er avhengig av denne tjenesten?
  const avhengigeAv = tjenester.filter((x) => x.avhengigheter.includes(t.navn)).map((x) => x.navn);
  return {
    navn: t.navn,
    beskrivelse: t.beskrivelse,
    eier_team: t.eier_team,
    vakt: t.vakt,
    avhengigheter: t.avhengigheter,
    avhengige_tjenester: avhengigeAv,
  };
}

export default {
  definisjon: {
    name: 'hent_tjenesteinfo',
    description:
      'Gir beskrivelse, eier, vakthavende og avhengigheter for en tjeneste, pluss hvilke tjenester som er avhengige av den. ' +
      'Nyttig for å finne rotårsak oppstrøms (hva alarmerende tjeneste bruker) og nedstrøms (hvem som merker feilen), ' +
      'og for å vite hvem som eier en tjeneste og hvem som skal vekkes. ' +
      'Tjenester: api-gateway, innlogging, betaling, sok, varsling, kunde-db.',
    input_schema: {
      type: 'object',
      properties: { tjeneste: { type: 'string', description: 'Tjenestenavn, f.eks. "kunde-db".' } },
      required: ['tjeneste'],
    },
  },
  kjør: async (input, kontekst) => hentTjenesteinfo(input, kontekst),
};
