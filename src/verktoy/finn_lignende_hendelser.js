import { lesJson } from './felles.js';

function finnLignendeHendelser({ tjeneste, tekst } = {}) {
  const hendelser = lesJson('hendelser.json');
  const sok = tekst?.toLowerCase();
  const treff = hendelser.filter((h) =>
    (!tjeneste || h.tjeneste === tjeneste) &&
    (!sok || [h.tittel, h.sammendrag, h.rotårsak].some((felt) => felt?.toLowerCase().includes(sok))));

  if (treff.length === 0) return 'Ingen tidligere hendelser matchet filteret. Prøv et bredere søkeord eller utelat tjenesten.';
  return treff;
}

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
        tekst: { type: 'string', description: 'Søkeord, f.eks. "disk" eller "timeout". Søker i tittel, sammendrag og rotårsak.' },
      },
    },
  },
  kjør: async (input, kontekst) => finnLignendeHendelser(input, kontekst),
};
