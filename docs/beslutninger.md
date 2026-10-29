# Beslutninger

Besluttet i planleggingsintervjuet 29. oktober 2026. Hver beslutning har en ID som `arbeidspakker.md` refererer til.

Status: **Besluttet** = eksplisitt valgt av teamet. **Antakelse** = foreslått av Claude og ikke eksplisitt bekreftet.

## Omfang

### BS-01 Ambisjon (Besluttet)
Løs oppgaven først. Bygg videre hvis tiden tillater.
Utvidelser står i `arbeidspakker.md` under AP-13.

### BS-02 Én alarm per kjøring (Besluttet)
Én kjøring av `npm start` utreder én alarm. Et skript kan kjøre alle fem etter hverandre (brukes av evalen).
*Forkastet:* alle fem samlet, begge modi. Kan tas som utvidelse.

### BS-03 Alarminput (Besluttet)
`npm start -- ALARM-0340` henter tid, tjeneste, alvorlighet og tekst fra `data/alarmer.json`. Fritekst støttes som reserve. Klokkeslett tolkes fra teksten. Mangler det, brukes siste logglinje som «nå», og rapporten sier det. Alvorlighet er ikke oppgitt for fritekst (se BS-12).

### BS-04 «Nå» er alarmtidspunktet (Besluttet)
Alle verktøy kapper tid ved alarmtidspunktet, så agenten ikke bruker etterpåklokskap.
Konsekvens: 03:05 kan ikke avsluttes som «løst». Agenten rapporterer «kjent mønster, forventes å gå over, sjekk igjen».
Et vent-verktøy er ikke med nå, men tas hvis tiden tillater (AP-13).

## Verktøy og handlinger

### BS-05 Verktøysett (Besluttet)
- Eksisterende: `sok_i_logger`.
- Stubber som implementeres: `hent_runbook`, `sjekk_deploy_historikk`, `finn_lignende_hendelser`.
- Nye: `utfor_tiltak` (BS-09), `varsle_vakt` (BS-11), `lever_rapport` (BS-14).
- `hent_tjenesteinfo` leser `tjenester.json` (avhengigheter, eier, vakt). Det trengs for å finne rotårsak på tvers av tjenester og for å avgjøre hvem som varsles. Se BS-23.

### BS-06 Handlinger (Besluttet)
Hvis runbooken beskriver et tiltak med liten risiko, utfører agenten det selv. Er agenten usikker, varsles vakt med en rapport om hva som er galt og mulige tiltak.

### BS-07 Tillatte tiltak (Besluttet)
| Tiltak | Kommando i runbook | Kilde |
|---|---|---|
| `rollback_betaling` | `deploy rollback betaling` | `betaling.md` |
| `pause_reindeks_sok` | `sokctl reindeks pause produkter-v7` | `sok.md` |
| `pause_leveringsvarsler` | `varslingctl pause mal=leveringsvarsel` (kø over 1000) | `varsling.md` |

Alt annet er ikke tillatt. Eksplisitt utelatt: sletting av loggarkiver (kan ikke angres) og restart av pgbouncer (utdatert).

### BS-08 Vilkår for å utføre et tiltak (Besluttet)
Alle tre må være oppfylt:
1. Runbooken er fersk og stemmer med det agenten ser i loggene.
2. Symptomene og tidspunktet for endringen matcher runbookens beskrivelse.
3. Tiltaket kan reverseres.

Ellers utføres ikke tiltaket, og vakt varsles med rapport.

### BS-09 Håndheving i kode (Besluttet)
Ett verktøy `utfor_tiltak` med enum over tiltakene i BS-07. Koden:
- avviser alt utenfor enumen,
- krever at runbooken for tiltakets tjeneste er hentet i samme kjøring,
- returnerer en feilmelding til modellen ved brudd.

Om runbooken er fersk, vurderer modellen (BS-08, punkt 1). Koden sjekker ikke datoen. Dette ble vurdert som en utvidelse og avvist for nå.
Uten runbook finnes ingen tiltak (gjelder api-gateway).
*Forkastet:* bare prompten, separate verktøy per tiltak.

### BS-10 Tiltak er simulert (Besluttet)
`utfor_tiltak` skriver tydelig `SIMULERT` i utskriften og returnerer en fast bekreftelse. Agenten kan ikke verifisere effekten, og rapporten skal si det.
*Forkastet:* tørrkjøring uten bekreftelse, tiltak som endrer loggdataene.

### BS-11 Varsling er simulert (Besluttet)
`varsle_vakt` slår opp vakt for riktig team i `tjenester.json` og «sender» rapporten (SIMULERT i utskrift).

## Varsling og rapport

### BS-12 Varslingsregel (Besluttet)
- Alarmer med `alvorlighet: kritisk` varsler alltid, også etter vellykket tiltak.
- Andre alarmer varsler bare ved usikkerhet: usikker årsak, tiltak ikke utført eller ikke tillatt, eller bare delvis demping.
- Falsk alarm gir ingen varsling.
- «Kritisk» er alarmens eget felt, ikke agentens vurdering. For fritekst uten felt behandles alarmen som ikke-kritisk med mindre teksten sier noe annet, og rapporten sier at alvorlighet ikke var oppgitt.

### BS-13 Hvem varsles (Besluttet)
Når årsaken ligger i en annen tjeneste enn den som alarmerer:
- primærvakt i årsakens team får varselet,
- primærvakt i alarmerende team får det i kopi,
- sekundærvakt brukes hvis primær ikke finnes,
- Team Nøkkelknippe varsles i tillegg hvis engangskoder er rammet (varsling-runbooken).

### BS-14 Strukturert rapport (Besluttet)
Agenten avslutter med verktøyet `lever_rapport` med fast skjema. Foreslåtte felt: alvorlighet, berørt tjeneste, sannsynlig årsak, sikkerhet (observert / antatt / ukjent), hva agenten ikke vet, utført tiltak, anbefalt neste steg, varslede team, ufullstendig (ja/nei).
Kallet avslutter løkka.
Detaljert skjema fastsettes i AP-06.

### BS-15 Iterasjonstak (Besluttet)
Når `MAX_ITERASJONER` nås uten rapport, gjøres ett siste kall der bare `lever_rapport` er tilgjengelig. Rapporten merkes ufullstendig og lister hva som ikke ble sjekket. Taket økes fra 10 til ca. 15.
Se BS-19 om varsling i dette tilfellet.

## Modell og kvalitet

### BS-16 Modell (Besluttet)
`claude-sonnet-5-5`, effort `medium`. Effort gjøres konfigurerbar via env-variabel. Den høynes bare hvis evalen feiler på de vanskelige alarmene (03:31 og 03:40).

### BS-17 Eval (Besluttet)
`data/fasit.json` med forventet utfall per alarm, og et skript som kjører alle fem alarmene og sjekker de strukturerte feltene deterministisk:
- riktig tjeneste i årsak,
- riktig tiltak (eller ingen),
- varslet ja/nei og riktig team,
- ikke-tomt «vet ikke» der det skal være,
- feller nevnes ikke som årsak.

*Forkastet:* LLM-dommer. Kan legges til senere.

### BS-18 Språk og konvensjoner (Besluttet)
Kode, identifikatorer, verktøybeskrivelser og dokumentasjon på norsk. Verktøynavn er ASCII. Se `CLAUDE.md`.

## Avklaringer

Teamet ga Claude i oppdrag å avgjøre de gjenstående punktene. Disse er avgjort av Claude og kan overstyres.

### BS-19 Varsling ved iterasjonstak (avklarer OS-01)
Hvis `MAX_ITERASJONER` nås og ingen `varsle_vakt` er kalt, kaller koden selv `varsle_vakt` etter den tvungne rapporten. Mottaker er vakten for den alarmerende tjenesten. Begrunnelse: en agent som feiler stille er verre enn en som vekker noen.

### BS-20 Oppfølging etter tiltak (avklarer OS-02)
«Lapp til Team Spåkula» og beskjed i #betaling-drift gjøres ikke som egne varsler. De nevnes i feltet «anbefalt neste steg» i rapporten. Begrunnelse: holder omfanget nede, og runbookene krever ikke at agenten selv sender dem.

### BS-21 Utfall for 03:05 (avklarer OS-03)
Ingen tiltak og ingen varsling. Rapporten sier «kjent mønster, forventes å gå over innen ca. 03:10», og at det ikke er verifisert på alarmtidspunktet.

### BS-22 Eval kjører flere ganger (avklarer OS-04)
Hver alarm kjøres 3 ganger (konfigurerbart med `ANTALL_KJORINGER`). En alarm består bare hvis alle kjøringer består. Skriptet viser også andel bestått per alarm.

### BS-23 `hent_tjenesteinfo` er et eget verktøy (avklarer OS-05)
Verktøyet er med i BS-05. Det er ikke lenger en antakelse.

### BS-24 Ærlighet om delvis demping (avklarer OS-06)
Når et tiltak bare demper et symptom og årsaken er uavklart (03:31), skal rapporten si det eksplisitt i feltet «vet ikke». Fasiten kontrollerer at feltet er ikke-tomt og nevner at årsaken er uavklart.

## Åpne spørsmål

Ingen.
