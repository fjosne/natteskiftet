export default {
  definisjon: {
    name: 'hent_runbook',
    description:
      'Henter runbooken for en tjeneste: hva teamet anbefaler å gjøre ved kjente feil, og hvem som skal vekkes. ' +
      'Sjekk datoen øverst. En gammel runbook kan beskrive oppsett som ikke finnes lenger, så sammenlign med det du ser i loggene.',
    input_schema: {
      type: 'object',
      properties: { tjeneste: { type: 'string', description: 'Tjenestenavn, f.eks. "sok".' } },
      required: ['tjeneste'],
    },
  },
  // TODO: les data/runbooks/<tjeneste>.md med fs.readFileSync. Finnes ikke fila,
  // kast en Error med lista over runbooks som finnes (fs.readdirSync).
  kjør: null,
};
