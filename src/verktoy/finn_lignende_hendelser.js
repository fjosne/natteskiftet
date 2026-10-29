export default {
  definisjon: {
    name: 'finn_lignende_hendelser',
    description:
      'Søker i tidligere hendelser med post-mortem: hva skjedde, rotårsak, hva som ble gjort og hvor lenge det varte. ' +
      'Nyttig for å se om dette har skjedd før. Vær nøye med forskjellene: en hendelse som ligner, er ikke nødvendigvis samme feil.',
    input_schema: {
      type: 'object',
      properties: {
        tjeneste: { type: 'string', description: 'Bare hendelser for denne tjenesten.' },
        tekst: { type: 'string', description: 'Søkeord, f.eks. "disk" eller "timeout".' },
      },
    },
  },
  // TODO: lesJson('hendelser.json') og filtrer på tjeneste og/eller om tekst finnes
  // i tittel, sammendrag eller rotårsak. Enkel tekstmatch holder lenge.
  kjør: null,
};
