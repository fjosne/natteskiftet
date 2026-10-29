import { lesJson, tilMs } from './felles.js';

function sjekkDeployHistorikk({ tjeneste, siden } = {}, kontekst) {
  const sidenMs = siden ? tilMs(siden) : -Infinity;
  const naaMs = kontekst?.nå ?? Infinity;
  const historikk = lesJson('deploy-historikk.json');
  const kjente = lesJson('tjenester.json').map((t) => t.navn);
  if (tjeneste && !kjente.includes(tjeneste)) throw new Error(`Ukjent tjeneste «${tjeneste}». Gyldige: ${kjente.join(', ')}`);

  // Endringer etter «nå» har ikke skjedd ennå fra agentens ståsted.
  const treff = historikk
    .filter((d) => (!tjeneste || d.tjeneste === tjeneste) && Date.parse(d.tid) > sidenMs && Date.parse(d.tid) <= naaMs)
    .sort((a, b) => Date.parse(b.tid) - Date.parse(a.tid));

  if (treff.length === 0) return 'Ingen endringer matchet filteret. Prøv uten tjeneste eller med et tidligere «siden».';
  return treff.map((d) => `${d.tid} ${d.tjeneste} ${d.versjon} (av ${d.av}): ${d.endring}`).join('\n');
}

export default {
  definisjon: {
    name: 'sjekk_deploy_historikk',
    description:
      'Viser utrullinger og konfigendringer, nyest først. Bruk den for å finne ut om noe ble endret rett før problemene startet. ' +
      'Husk at konfig- og cron-endringer også teller, og at en endring for flere dager siden kan slå inn først nå. ' +
      'Du ser bare endringer til og med tidspunktet alarmen gikk.',
    input_schema: {
      type: 'object',
      properties: {
        tjeneste: { type: 'string', description: 'Bare endringer for denne tjenesten. Utelat for alle.' },
        siden: { type: 'string', description: 'Bare endringer etter dette tidspunktet, "03:00" eller full ISO-tid.' },
      },
    },
  },
  kjør: async (input, kontekst) => sjekkDeployHistorikk(input, kontekst),
};
