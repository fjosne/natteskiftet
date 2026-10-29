// Evalskriptet (AP-11): kjører alarmene mot agenten og sjekker rapporten deterministisk mot data/fasit.json.
// npm run eval                      alle fem alarmene, ANTALL_KJORINGER ganger hver (standard 3)
// npm run eval -- ALARM-0340        bare én alarm
// EVAL_STILLE=1 sender agentens egen utskrift til en loggfil per kjøring.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { kjørAgent } from './agent.js';
import { system, verktøy } from './verktoy.js';
import { lagAlarmInput } from './alarm.js';
import { lastEnv } from './miljo.js';
import { lesJson } from './verktoy/felles.js';

const grønn = (t) => `\x1b[32m${t}\x1b[0m`;
const rød = (t) => `\x1b[31m${t}\x1b[0m`;
const grå = (t) => `\x1b[90m${t}\x1b[0m`;

const FLAGG = 'iu';
const tomListe = (l) => !Array.isArray(l) || l.length === 0;
const fmt = (l) => (tomListe(l) ? '(ingen)' : l.join(', '));

// Setninger deles på punktum + mellomrom, semikolon, linjeskift, ? og ! (se _beskrivelse i fasiten).
const tilSetninger = (tekst) => String(tekst ?? '').split(/\.\s+|[;\n?!]/).map((s) => s.trim()).filter(Boolean);

// Ren sjekkfunksjon, uten API. fasitAlarm er oppføringen under «alarmer» i fasiten,
// mønstre er «mønstre»-objektet. Returnerer en liste med { sjekk, ok, begrunnelse }.
// utførteTiltak er tiltakene utfor_tiltak faktisk gjennomførte (null hvis ukjent, da sjekkes bare rapporten).
export function sjekkKjøring(fasitAlarm, { rapport, varslet = [], utførteTiltak = null }, mønstre = {}) {
  if (!rapport) return [{ sjekk: 'rapport', ok: false, begrunnelse: 'ingen rapport' }];

  const f = fasitAlarm;
  const resultater = [];
  const sjekk = (navn, ok, forventet, faktisk) =>
    resultater.push({ sjekk: navn, ok, begrunnelse: ok ? 'ok' : `forventet ${forventet}, faktisk ${faktisk}` });
  const lik = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

  sjekk('alvorlighet', rapport.alvorlighet === f.alvorlighet, `«${f.alvorlighet}»`, `«${rapport.alvorlighet}»`);
  sjekk('berort_tjeneste', lik(rapport.berort_tjeneste, f.berort_tjeneste), `«${f.berort_tjeneste}»`, `«${rapport.berort_tjeneste}»`);
  sjekk('arsak_tjeneste', f.arsak_tjeneste_godtatt.some((t) => lik(t, rapport.arsak_tjeneste)),
    `en av ${f.arsak_tjeneste_godtatt.map((t) => `«${t}»`).join(', ')}`, `«${rapport.arsak_tjeneste}»`);

  // Tiltak: rapporten og de faktiske utfor_tiltak-kallene.
  sjekk('utfort_tiltak', rapport.utfort_tiltak === f.tiltak, `«${f.tiltak}»`, `«${rapport.utfort_tiltak}»`);
  const forbudtIRapport = f.forbudte_tiltak.includes(rapport.utfort_tiltak);
  const forbudtUtført = (utførteTiltak ?? []).filter((t) => f.forbudte_tiltak.includes(t));
  sjekk('forbudte_tiltak', !forbudtIRapport && forbudtUtført.length === 0,
    `ingen av ${f.forbudte_tiltak.join(', ')}`,
    [forbudtIRapport && `rapporten sier «${rapport.utfort_tiltak}»`, forbudtUtført.length && `utført: ${forbudtUtført.join(', ')}`].filter(Boolean).join('; '));
  if (f.tiltak === 'ingen' && utførteTiltak?.length) {
    sjekk('ingen_tiltak_utfort', false, 'ingen utfor_tiltak-kall', `utført: ${utførteTiltak.join(', ')}`);
  }

  // Varsling: faktiske varsle_vakt-kall (varslet) er fasit, rapportens varslede_team må stemme med dem.
  const v = f.varsling;
  const iRapport = Array.isArray(rapport.varslede_team) ? rapport.varslede_team : [];
  if (v.skal_varsle) {
    sjekk('varslet', varslet.length > 0, 'varsle_vakt kalt minst én gang', 'varsle_vakt ikke kalt');
  } else {
    sjekk('varslet', varslet.length === 0 && iRapport.length === 0, 'ingen varsling',
      `varsle_vakt varslet ${fmt(varslet)}; rapporten oppgir ${fmt(iRapport)}`);
  }
  const manglerKall = v.krevd_team.filter((t) => !varslet.includes(t));
  const manglerRapport = v.krevd_team.filter((t) => !iRapport.includes(t));
  sjekk('krevd_team', manglerKall.length === 0 && manglerRapport.length === 0, `varslet ${fmt(v.krevd_team)}`,
    [manglerKall.length && `mangler i varsle_vakt-kall: ${manglerKall.join(', ')}`, manglerRapport.length && `mangler i rapportens varslede_team: ${manglerRapport.join(', ')}`].filter(Boolean).join('; '));
  const forbudteTeam = v.forbudte_team.filter((t) => varslet.includes(t) || iRapport.includes(t));
  sjekk('forbudte_team', forbudteTeam.length === 0, `ingen av ${v.forbudte_team.join(', ')}`, `varslet ${forbudteTeam.join(', ')}`);

  // «Vet ikke».
  const vetIkke = (Array.isArray(rapport.vet_ikke) ? rapport.vet_ikke : []).filter((x) => typeof x === 'string' && x.trim());
  if (f.vet_ikke.ikke_tom) sjekk('vet_ikke_ikke_tom', vetIkke.length > 0, 'minst ett element', 'tom liste');
  if (f.vet_ikke.ma_matche) {
    const re = new RegExp(f.vet_ikke.ma_matche, FLAGG);
    sjekk('vet_ikke_ma_matche', vetIkke.some((x) => re.test(x)), `element som matcher /${f.vet_ikke.ma_matche}/`,
      vetIkke.length ? `[${vetIkke.map((x) => `«${x}»`).join(', ')}]` : 'tom liste');
  }

  // Må nevne riktig mekanisme i sannsynlig_arsak.
  if (f.ma_nevne_i_arsak) {
    sjekk('ma_nevne_i_arsak', new RegExp(f.ma_nevne_i_arsak, FLAGG).test(String(rapport.sannsynlig_arsak ?? '')),
      `treff på /${f.ma_nevne_i_arsak}/`, `«${rapport.sannsynlig_arsak}»`);
  }

  // Feller: bare sannsynlig_arsak og arsak_tjeneste. Setning treffer hvis den matcher monster og ingen unntak.
  const setninger = [...tilSetninger(rapport.sannsynlig_arsak), ...tilSetninger(rapport.arsak_tjeneste)];
  for (const felle of f.feller) {
    const monster = new RegExp(felle.monster, FLAGG);
    const unntak = (felle.unntak ?? []).map((navn) => {
      if (!mønstre[navn]) throw new Error(`Felle «${felle.id}» bruker ukjent unntaksmønster «${navn}».`);
      return new RegExp(mønstre[navn], FLAGG);
    });
    const treff = setninger.find((s) => monster.test(s) && !unntak.some((u) => u.test(s)));
    sjekk(`felle:${felle.id}`, treff === undefined, 'felle ikke brukt som årsak', `«${treff}»`);
  }
  return resultater;
}

// Pakker utfor_tiltak så vi vet hvilke tiltak som faktisk ble gjennomført (kontekst lagrer det ikke).
function medTiltaksLogg(utførte) {
  return verktøy.map((v) => {
    if (v.definisjon.name !== 'utfor_tiltak' || !v.kjør) return v;
    return { ...v, kjør: async (input, kontekst) => {
      const resultat = await v.kjør(input, kontekst);
      utførte.push(input?.tiltak);
      return resultat;
    } };
  });
}

// Én kjøring. Kaster aldri: feil blir til en feilet kjøring med begrunnelse.
async function kjørÉn(fasit, alarm, nr, stille) {
  const loggfil = stille ? path.join(os.tmpdir(), 'natteskiftet-eval', `${alarm.id}-${nr}.log`) : null;
  const opprinnelig = console.log;
  if (loggfil) {
    fs.mkdirSync(path.dirname(loggfil), { recursive: true });
    fs.writeFileSync(loggfil, '');
    console.log = (...a) => fs.appendFileSync(loggfil, a.join(' ') + '\n');
  }
  const utførte = [];
  try {
    const { oppgave, nå, alarm: alarmObjekt } = lagAlarmInput(alarm.id);
    const { rapport, varslet } = await kjørAgent({ system, oppgave, verktøy: medTiltaksLogg(utførte), nå, alarm: alarmObjekt });
    const sjekker = sjekkKjøring(fasit.alarmer[alarm.id], { rapport, varslet, utførteTiltak: utførte }, fasit.mønstre);
    return { nr, loggfil, sjekker };
  } catch (e) {
    return { nr, loggfil, sjekker: [{ sjekk: 'kjøring', ok: false, begrunnelse: e.message }] };
  } finally {
    console.log = opprinnelig;
  }
}

export async function kjørEval({ filter, antall, stille }) {
  const fasit = lesJson('fasit.json');
  let alarmer = lesJson('alarmer.json');
  if (filter) {
    alarmer = alarmer.filter((a) => a.id.toLowerCase() === filter.toLowerCase());
    if (!alarmer.length) throw new Error(`Ukjent alarm «${filter}». Gyldige ID-er: ${lesJson('alarmer.json').map((a) => a.id).join(', ')}`);
  }
  for (const a of alarmer) {
    if (!fasit.alarmer[a.id]) throw new Error(`Fasiten mangler ${a.id}.`);
  }

  const oppsummering = [];
  for (const alarm of alarmer) {
    console.log(`\n${alarm.id} (${alarm.tjeneste}, ${alarm.tid.slice(11, 16)}): ${antall} kjøring${antall === 1 ? '' : 'er'}`);
    const kjøringer = [];
    for (let nr = 1; nr <= antall; nr++) {
      const k = await kjørÉn(fasit, alarm, nr, stille);
      kjøringer.push(k);
      const ok = k.sjekker.every((s) => s.ok);
      console.log(`  kjøring ${nr}: ${ok ? grønn('bestått') : rød('FEILET')}`);
      for (const s of k.sjekker.filter((x) => !x.ok)) console.log(`    ${rød('✖')} ${s.sjekk}: ${s.begrunnelse}`);
      if (!ok && k.loggfil) console.log(grå(`    logg: ${k.loggfil}`));
    }
    const bestått = kjøringer.filter((k) => k.sjekker.every((s) => s.ok)).length;
    const feller = [...new Set(kjøringer.flatMap((k) => k.sjekker.filter((s) => !s.ok && s.sjekk.startsWith('felle:')).map((s) => s.sjekk.slice(6))))];
    console.log(`  ${bestått === antall ? grønn('BESTÅTT') : rød('FEILET')} ${bestått}/${antall}${feller.length ? `  feller som slo ut: ${feller.join(', ')}` : ''}`);
    oppsummering.push({ id: alarm.id, bestått, antall, feller });
  }

  console.log('\nSamlet');
  console.log('Alarm        Bestått  Resultat');
  for (const r of oppsummering) {
    const ok = r.bestått === r.antall;
    console.log(`${r.id.padEnd(12)} ${`${r.bestått}/${r.antall}`.padEnd(8)} ${ok ? grønn('bestått') : rød('feilet')}${r.feller.length ? ` (feller: ${r.feller.join(', ')})` : ''}`);
  }
  const alleOk = oppsummering.every((r) => r.bestått === r.antall);
  console.log(`\n${oppsummering.filter((r) => r.bestått === r.antall).length}/${oppsummering.length} alarmer bestått.`);
  return alleOk;
}

// Kjører bare når fila startes direkte, slik at sjekkKjøring kan importeres i tester.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  lastEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Mangler ANTHROPIC_API_KEY. Kopier .env.example til .env og lim inn nøkkelen.');
    process.exit(1);
  }
  const antall = Number(process.env.ANTALL_KJORINGER || 3);
  if (!Number.isInteger(antall) || antall < 1) {
    console.error(`Ugyldig ANTALL_KJORINGER «${process.env.ANTALL_KJORINGER}». Bruk et heltall på minst 1.`);
    process.exit(1);
  }
  const stille = ['1', 'true', 'ja'].includes((process.env.EVAL_STILLE ?? '').toLowerCase());
  try {
    const ok = await kjørEval({ filter: process.argv[2], antall, stille });
    if (stille) console.log(grå(`Agentens utskrift per kjøring ligger i ${path.join(os.tmpdir(), 'natteskiftet-eval')}`));
    process.exit(ok ? 0 : 1);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
