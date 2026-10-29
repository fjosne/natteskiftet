export default {
  definisjon: {
    name: 'sjekk_deploy_historikk',
    description:
      'Viser utrullinger og konfigendringer, nyest først. Bruk den for å finne ut om noe ble endret rett før problemene startet. ' +
      'Husk at konfig- og cron-endringer også teller, og at en endring for flere dager siden kan slå inn først nå.',
    input_schema: {
      type: 'object',
      properties: {
        tjeneste: { type: 'string', description: 'Bare endringer for denne tjenesten. Utelat for alle.' },
        siden: { type: 'string', description: 'Bare endringer etter dette tidspunktet (ISO-tid).' },
      },
    },
  },
  // TODO: lesJson('deploy-historikk.json'), filtrer på tjeneste og siden
  // (Date.parse), sorter nyest først.
  kjør: null,
};
