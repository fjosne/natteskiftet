// Agent-løkken. Hele «agent-greia» er dette: spør modellen, kjør verktøyene
// den ber om, send resultatene tilbake, gjenta til den er ferdig.
import Anthropic from '@anthropic-ai/sdk';
import { lesJson } from './verktoy/felles.js';

// Gyldige verdier for output_config.effort i SDK-en (xhigh finnes i typene, men ikke på alle modeller).
const GYLDIG_EFFORT = ['low', 'medium', 'high', 'xhigh', 'max'];

// Env leses i kjørAgent og ikke på toppnivå: index.js laster .env først etter at denne fila er importert.
function lesInnstillinger() {
  const effort = process.env.EFFORT || 'medium';
  if (!GYLDIG_EFFORT.includes(effort)) {
    throw new Error(`Ugyldig EFFORT «${effort}». Gyldige verdier: ${GYLDIG_EFFORT.join(', ')}.`);
  }
  // Stopper en agent som går i ring før den brenner opp kostnadstaket.
  const maks = Number(process.env.MAX_ITERASJONER || 15);
  if (!Number.isInteger(maks) || maks < 1) {
    throw new Error(`Ugyldig MAX_ITERASJONER «${process.env.MAX_ITERASJONER}». Bruk et heltall på minst 1.`);
  }
  return { modell: process.env.MODELL ?? 'claude-sonnet-5-5', effort, maks };
}

// Opprettes ved første kjøring, av samme grunn som over: API-nøkkelen kan komme fra .env.
let klient;

const grå = (t) => `\x1b[90m${t}\x1b[0m`;
const oransje = (t) => `\x1b[38;5;208m${t}\x1b[0m`;
const grønn = (t) => `\x1b[32m${t}\x1b[0m`;

// kontekst opprettes per kjøring og sendes som andre argument til hvert verktøy:
// kjør(input, kontekst). Feltene:
//   nå              Tidspunktet agenten «lever» på, i ms (som Date.parse). Infinity = ingen grense.
//   alarm           Alarmen som utløste kjøringen (objekt), eller null.
//   hentedeRunbooks Set med tjenestenavn agenten har hentet runbook for.
//   varslet         Liste med team agenten har varslet.
//   rapport         Den ferdige situasjonsrapporten. Settes av lever_rapport, ellers null.
// Returnerer { rapport, varslet, kontekst, svar }. rapport er null hvis modellen stoppet
// uten å levere rapport. svar er det siste svaret fra modellen.
export async function kjørAgent({ system, oppgave, verktøy, nå, alarm }) {
  const { modell, effort, maks } = lesInnstillinger();
  klient ??= new Anthropic();
  const kontekst = { nå, alarm, hentedeRunbooks: new Set(), varslet: [], rapport: null };
  const resultatFra = (svar) => ({ rapport: kontekst.rapport, varslet: kontekst.varslet, kontekst, svar });

  // Bare verktøy med en kjør-funksjon sendes til modellen. Stubbene i
  // verktoy.js blir med av seg selv når dere implementerer dem.
  const aktive = verktøy.filter((v) => v.kjør);
  const etterNavn = new Map(aktive.map((v) => [v.definisjon.name, v]));

  const messages = [{ role: 'user', content: oppgave }];

  for (let i = 1; i <= maks; i++) {
    const svar = await klient.messages.create({
      model: modell,
      max_tokens: 16000,
      output_config: { effort },
      system,
      tools: aktive.map((v) => v.definisjon),
      messages,
    });

    messages.push({ role: 'assistant', content: svar.content });

    for (const blokk of svar.content) {
      if (blokk.type === 'text' && blokk.text.trim()) {
        console.log(svar.stop_reason === 'tool_use' ? grå(blokk.text) : blokk.text);
      }
    }

    if (svar.stop_reason === 'end_turn') return resultatFra(svar);
    if (svar.stop_reason === 'refusal') {
      console.log(oransje(`\n✖ Modellen avslo (${svar.stop_details?.category ?? 'ukjent grunn'}).`));
      return resultatFra(svar);
    }
    if (svar.stop_reason === 'max_tokens') {
      console.log(oransje('\n✖ Svaret ble kuttet (max_tokens).'));
      return resultatFra(svar);
    }

    // Modellen kan be om flere verktøy samtidig. Alle resultatene må tilbake
    // i én og samme melding.
    const kall = svar.content.filter((b) => b.type === 'tool_use');
    const resultater = [];
    for (const k of kall) {
      console.log(oransje(`→ ${k.name}`) + grå(` ${JSON.stringify(k.input)}`));
      resultater.push(await kjørVerktøy(etterNavn, k, kontekst));
    }
    messages.push({ role: 'user', content: resultater });

    // lever_rapport avslutter vakten: rapporten er gyldig og løkka stopper.
    if (kontekst.rapport) {
      skrivRapport(kontekst.rapport);
      return resultatFra(svar);
    }
  }

  console.log(oransje(`\n✖ Stoppet etter ${maks} runder (MAX_ITERASJONER). Ber om en siste rapport.`));
  return await tvungenRapport({ messages, etterNavn, verktøy, kontekst, system, modell, effort, resultatFra });
}

// Taket er nådd uten rapport: ett siste kall der bare lever_rapport er tilgjengelig.
// OBS: tvunget tool_choice kan kollidere med tenkning eller effort på enkelte modeller.
async function tvungenRapport({ messages, etterNavn, verktøy, kontekst, system, modell, effort, resultatFra }) {
  const lever = etterNavn.get('lever_rapport');
  if (!lever) {
    console.log(oransje('⚠ lever_rapport finnes ikke blant verktøyene, så siste rapport kan ikke hentes.'));
    return resultatFra(null);
  }

  // Siste melding er brukermeldingen med tool_result for alle tool_use fra forrige runde.
  // Beskjeden legges i den samme meldingen, så API-et ikke får to brukermeldinger på rad.
  messages[messages.length - 1].content.push({
    type: 'text',
    text: 'Dette er siste runde: du får ikke bruke flere verktøy. Lever rapporten med lever_rapport nå. ' +
      'Sett ufullstendig til true og list i ikke_sjekket hva du ikke rakk å sjekke.',
  });

  const svar = await klient.messages.create({
    model: modell,
    max_tokens: 16000,
    output_config: { effort },
    system,
    tools: [lever.definisjon],
    tool_choice: { type: 'tool', name: 'lever_rapport' },
    messages,
  });
  messages.push({ role: 'assistant', content: svar.content });

  const kall = svar.content.find((b) => b.type === 'tool_use' && b.name === 'lever_rapport');
  if (!kall) {
    console.log(oransje('✖ Modellen leverte ingen rapport i siste runde.'));
    return resultatFra(svar);
  }
  console.log(oransje(`→ ${kall.name}`) + grå(` ${JSON.stringify(kall.input)}`));
  const resultat = await kjørVerktøy(etterNavn, kall, kontekst);
  if (!kontekst.rapport) {
    // Valideringen avviste rapporten, og vi har ingen flere runder. Bygg en minimal rapport av det modellen sendte.
    const r = kall.input ?? {};
    kontekst.rapport = {
      alvorlighet: kontekst.alarm?.alvorlighet ?? 'ikke_oppgitt',
      berort_tjeneste: kontekst.alarm?.tjeneste ?? 'ukjent',
      arsak_tjeneste: 'ukjent',
      sannsynlig_arsak: 'Uavklart.',
      observert: [], antatt: [], utfort_tiltak: 'ingen', tiltak_effekt_verifisert: false,
      anbefalt_neste_steg: [], varslede_team: [],
      ...r,
      vet_ikke: [...(Array.isArray(r.vet_ikke) ? r.vet_ikke : []), `Siste rapport ble avvist av valideringen: ${resultat.content}`],
    };
  }

  // Koden bestemmer at rapporten er ufullstendig, uansett hva modellen satte.
  const rapport = kontekst.rapport;
  rapport.ufullstendig = true;
  if (!Array.isArray(rapport.ikke_sjekket) || rapport.ikke_sjekket.length === 0) {
    rapport.ikke_sjekket = ['Utredningen ble avbrutt av iterasjonstaket, og modellen oppga ikke hva som gjensto.'];
  }

  await varsleAutomatisk({ verktøy, kontekst, rapport });
  skrivRapport(rapport);
  return resultatFra(svar);
}

// BS-19: en agent som feiler stille er verre enn en som vekker noen.
async function varsleAutomatisk({ verktøy, kontekst, rapport }) {
  if (kontekst.varslet.length > 0) return;
  const varsle = verktøy.find((v) => v.definisjon.name === 'varsle_vakt' && v.kjør);
  if (!varsle) {
    console.log(oransje('⚠ varsle_vakt finnes ikke, så ingen er varslet automatisk. Vakt må varsles manuelt.'));
    return;
  }
  const tjeneste = kontekst.alarm?.tjeneste ?? rapport.berort_tjeneste;
  const team = lesJson('tjenester.json').find((t) => t.navn === tjeneste)?.eier_team;
  if (!team) {
    console.log(oransje(`⚠ Fant ikke eier-team for «${tjeneste}», så ingen er varslet automatisk. Vakt må varsles manuelt.`));
    return;
  }
  const melding = 'Agenten nådde iterasjonstaket uten å bli ferdig, så rapporten er ufullstendig. ' +
    `Sannsynlig årsak: ${rapport.sannsynlig_arsak} Ikke sjekket: ${rapport.ikke_sjekket.join('; ')}`;
  try {
    console.log(oransje('→ varsle_vakt') + grå(` (automatisk, ${team})`));
    await varsle.kjør({ til: team, kopi: [], melding }, kontekst);
    rapport.varslede_team = [...new Set([...(rapport.varslede_team ?? []), ...kontekst.varslet])];
  } catch (e) {
    console.log(oransje(`⚠ Automatisk varsling feilet: ${e.message}. Vakt må varsles manuelt.`));
  }
}

// Skriver rapporten lesbart, med observert, antatt og ukjent i hver sin seksjon.
function skrivRapport(r) {
  const punkter = (l) => (l?.length ? l.map((x) => `  - ${x}`).join('\n') : '  (ingen)');
  const tiltak = r.utfort_tiltak === 'ingen' ? 'ingen'
    : `${r.utfort_tiltak} (effekt ${r.tiltak_effekt_verifisert ? 'verifisert' : 'IKKE verifisert'})`;
  console.log(`
${oransje('═══ SITUASJONSRAPPORT ═══')}${r.ufullstendig ? oransje(' (UFULLSTENDIG)') : ''}
Alvorlighet:       ${r.alvorlighet}
Berørt tjeneste:   ${r.berort_tjeneste}
Årsak sitter i:    ${r.arsak_tjeneste}
Sannsynlig årsak:  ${r.sannsynlig_arsak}

${grønn('OBSERVERT (sett i dataene)')}
${punkter(r.observert)}

${oransje('ANTATT (ikke bekreftet)')}
${punkter(r.antatt)}

${oransje('VET IKKE')}
${punkter(r.vet_ikke)}
${r.ufullstendig ? `\n${oransje('IKKE SJEKKET')}\n${punkter(r.ikke_sjekket)}\n` : ''}
Utført tiltak:     ${tiltak}
Varslede team:     ${r.varslede_team?.length ? r.varslede_team.join(', ') : '(ingen)'}

Anbefalt neste steg:
${punkter(r.anbefalt_neste_steg)}`);
}

async function kjørVerktøy(etterNavn, kall, kontekst) {
  const v = etterNavn.get(kall.name);
  if (!v) {
    return feil(kall, `Ukjent verktøy «${kall.name}». Gyldige: ${[...etterNavn.keys()].join(', ')}`);
  }
  try {
    const resultat = await v.kjør(kall.input, kontekst);
    const tekst = typeof resultat === 'string' ? resultat : JSON.stringify(resultat, null, 2);
    console.log(grønn(`  ✓ ${tekst.length} tegn tilbake`));
    return { type: 'tool_result', tool_use_id: kall.id, content: tekst };
  } catch (e) {
    return feil(kall, e.message);
  }
}

function feil(kall, melding) {
  console.log(oransje(`  ✖ ${melding}`));
  return { type: 'tool_result', tool_use_id: kall.id, content: melding, is_error: true };
}
