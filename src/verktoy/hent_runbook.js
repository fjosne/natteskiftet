import fs from 'node:fs';
import path from 'node:path';
import { DATA } from './felles.js';

const MAPPE = path.join(DATA, 'runbooks');

function hentRunbook({ tjeneste } = {}, kontekst) {
  // Gyldige navn er filene som faktisk finnes. Alt annet (../, absolutte stier osv.) avvises.
  const finnes = fs.readdirSync(MAPPE).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  if (typeof tjeneste !== 'string' || !finnes.includes(tjeneste)) {
    throw new Error(`Fant ingen runbook for «${tjeneste}». Runbooks finnes for: ${finnes.join(', ')}`);
  }
  const innhold = fs.readFileSync(path.join(MAPPE, `${tjeneste}.md`), 'utf8');
  kontekst?.hentedeRunbooks?.add(tjeneste);
  return innhold;
}

export default {
  definisjon: {
    name: 'hent_runbook',
    description:
      'Henter runbooken for en tjeneste: hva teamet anbefaler å gjøre ved kjente feil, og hvem som skal vekkes. ' +
      'Sjekk datoen øverst. En gammel runbook kan beskrive oppsett som ikke finnes lenger, så sammenlign med det du ser i loggene. ' +
      'Ikke alle tjenester har runbook: finnes den ikke, får du lista over de som har.',
    input_schema: {
      type: 'object',
      properties: { tjeneste: { type: 'string', description: 'Tjenestenavn, f.eks. "sok".' } },
      required: ['tjeneste'],
    },
  },
  kjør: async (input, kontekst) => hentRunbook(input, kontekst),
};
