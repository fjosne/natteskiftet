const TILTAK = ['rollback_betaling', 'pause_reindeks_sok', 'pause_leveringsvarsler', 'ingen'];
const ALVORLIGHET = ['kritisk', 'høy', 'advarsel', 'ikke_oppgitt'];

const liste = (beskrivelse) => ({ type: 'array', items: { type: 'string' }, description: beskrivelse });

// Felt som må være med. Typen sjekkes i kjør, siden required ikke håndheves av API-et.
const PÅKREVD = {
  alvorlighet: 'string',
  berort_tjeneste: 'string',
  arsak_tjeneste: 'string',
  sannsynlig_arsak: 'string',
  observert: 'liste',
  antatt: 'liste',
  vet_ikke: 'liste',
  utfort_tiltak: 'string',
  tiltak_effekt_verifisert: 'boolean',
  anbefalt_neste_steg: 'liste',
  varslede_team: 'liste',
  ufullstendig: 'boolean',
};

export default {
  definisjon: {
    name: 'lever_rapport',
    description:
      'Leverer den endelige situasjonsrapporten og avslutter vakten din. Kall den nøyaktig én gang, når du er ferdig eller ikke kommer lenger. ' +
      'Hold tydelig fra hverandre det du har sett i dataene (observert), det du antar (antatt) og det du ikke vet (vet_ikke). ' +
      'vet_ikke er påkrevd: er det virkelig ingenting du er usikker på, send en tom liste. Men tenk deg om en ekstra gang først. ' +
      'Har et tiltak bare dempet symptomet og årsaken er uavklart, skal det stå i vet_ikke. ' +
      'Du kan ikke verifisere effekten av simulerte tiltak, så sett tiltak_effekt_verifisert til false med mindre loggene viser at feilen er borte. ' +
      'Har du ikke rukket å sjekke alt, sett ufullstendig til true og list det du ikke sjekket i ikke_sjekket.',
    input_schema: {
      type: 'object',
      properties: {
        alvorlighet: {
          type: 'string',
          enum: ALVORLIGHET,
          description: 'Alarmens egen alvorlighet hvis den er oppgitt, ellers "ikke_oppgitt". Ikke vurder den selv.',
        },
        berort_tjeneste: { type: 'string', description: 'Tjenesten som alarmerte, f.eks. "betaling".' },
        arsak_tjeneste: {
          type: 'string',
          description: 'Tjenesten der årsaken sitter (kan være en annen enn den berørte), eller "ukjent" hvis du ikke vet.',
        },
        sannsynlig_arsak: { type: 'string', description: 'Kort beskrivelse av sannsynlig årsak, eller at den er uavklart.' },
        observert: liste('Det du faktisk har sett i dataene (logger, deploys, runbook), gjerne med klokkeslett.'),
        antatt: liste('Slutninger og antakelser du ikke har direkte belegg for i dataene.'),
        vet_ikke: liste('Det du ikke vet eller ikke har kunnet avklare. Påkrevd, men kan være en tom liste.'),
        utfort_tiltak: { type: 'string', enum: TILTAK, description: 'Tiltaket du utførte, eller "ingen".' },
        tiltak_effekt_verifisert: {
          type: 'boolean',
          description: 'True bare hvis du har sett i dataene at tiltaket virket. Ved "ingen" tiltak: false.',
        },
        anbefalt_neste_steg: liste('Konkrete neste steg for mennesket som overtar, i prioritert rekkefølge.'),
        varslede_team: liste('Teamene du har varslet med varsle_vakt. Tom liste hvis ingen.'),
        ufullstendig: { type: 'boolean', description: 'True hvis utredningen ikke ble ferdig.' },
        ikke_sjekket: liste('Hva du ikke rakk å sjekke. Brukes når ufullstendig er true.'),
      },
      required: Object.keys(PÅKREVD),
    },
  },
  kjør: async (input, kontekst) => {
    const r = input ?? {};
    const mangler = Object.keys(PÅKREVD).filter((f) => r[f] === undefined || r[f] === null);
    if (mangler.length) {
      throw new Error(
        `Rapporten er ikke gyldig. Mangler: ${mangler.join(', ')}. ` +
        'vet_ikke må være med (en tom liste er lov). Kall lever_rapport på nytt med alle feltene.');
    }
    const feil = [];
    for (const [felt, type] of Object.entries(PÅKREVD)) {
      const ok = type === 'liste' ? Array.isArray(r[felt]) : typeof r[felt] === type;
      if (!ok) feil.push(`${felt} må være ${type === 'liste' ? 'en liste' : type}`);
    }
    if (!TILTAK.includes(r.utfort_tiltak)) feil.push(`utfort_tiltak må være en av: ${TILTAK.join(', ')}`);
    if (r.ikke_sjekket !== undefined && !Array.isArray(r.ikke_sjekket)) feil.push('ikke_sjekket må være en liste');
    if (r.ufullstendig && !r.ikke_sjekket?.length) feil.push('ufullstendig er true, så ikke_sjekket må liste hva du ikke sjekket');
    if (feil.length) throw new Error(`Rapporten er ikke gyldig: ${feil.join('; ')}. Kall lever_rapport på nytt.`);

    kontekst.rapport = { ...r, ikke_sjekket: r.ikke_sjekket ?? [] };
    return 'Rapporten er levert. Vakten er over.';
  },
};
