# Arbeidspakker

Utkast til tickets. Hver pakke peker til beslutningene i `beslutninger.md`. Rekkefølgen følger avhengighetene.

| ID | Tittel | Avhenger av |
|---|---|---|
| AP-00 | Kontrakt: kontekst og ett verktøy per fil | |
| AP-01 | `hent_runbook` | AP-00 |
| AP-02 | `sjekk_deploy_historikk` | AP-00 |
| AP-03 | `finn_lignende_hendelser` | AP-00 |
| AP-04 | `hent_tjenesteinfo` | AP-00 |
| AP-05 | Alarminput og klokke | AP-00 |
| AP-06 | `lever_rapport` | AP-00 |
| AP-07 | `utfor_tiltak` | AP-00 (bruker kontrakten, ikke AP-01) |
| AP-08 | `varsle_vakt` | AP-00 |
| AP-09 | Iterasjonstak | AP-06 |
| AP-10 | Systemprompt | AP-06, AP-07, AP-08 |
| AP-11 | Fasit og eval | fasit: ingen. Skript: AP-05, AP-06 |
| AP-12 | Effort via env | |
| AP-13 | Utvidelser | alle |

## AP-00 Kontrakt: kontekst og ett verktøy per fil
Forberedelse som fjerner flettekonflikter. Alle de andre pakkene bygger på dette.
1. Flytt hvert verktøy fra `src/verktoy.js` til sin egen fil under `src/verktoy/`. `src/verktoy.js` samler dem og beholder `system`, `eksempelOppgave` og `verktøy`.
2. Innfør et `kontekst`-objekt som `agent.js` oppretter per kjøring og sender som andre argument: `kjør(input, kontekst)`. Felter: `nå` (ms), `alarm` (objekt eller `null`), `hentedeRunbooks` (`Set` med tjenestenavn), `varslet` (liste med team), `rapport` (settes av `lever_rapport`).
3. `kjørAgent` tar `kontekst`-verdier inn fra `index.js` (`nå` og `alarm`). Foreløpig settes `nå` til `Infinity` og `alarm` til `null`.
**Akseptkriterier**
- `npm start` gir samme oppførsel som før.
- Hvert verktøy ligger i sin egen fil, og `kjør` mottar `kontekst`.
- Feltene over er dokumentert i en kommentar i `src/agent.js`.

## AP-01 `hent_runbook` (BS-09)
Implementer stubben i `src/verktoy.js`: les `data/runbooks/<tjeneste>.md`. Finnes den ikke, kast en `Error` med lista over runbooks som finnes. Legg tjenestenavnet i `kontekst.hentedeRunbooks` (brukes av AP-07).
**Akseptkriterier**
- `hent_runbook("sok")` returnerer innholdet.
- `hent_runbook("api-gateway")` gir feilmelding med de fem tjenestene som har runbook.
- Ugyldige tjenestenavn (f.eks. `../`) slipper ikke ut av `data/runbooks`.

## AP-02 `sjekk_deploy_historikk` (BS-04)
Filtrer på tjeneste og `siden`, sorter nyest først, og kapp alt etter «nå». La `siden` godta samme formater som `tilMs`.
**Akseptkriterier**
- For alarm 03:12 er release 2.14.0 øverst for betaling.
- Endringer etter «nå» returneres aldri.
- Konfig- og cron-endringer (f.eks. kunde-db 22/10) er med.

## AP-03 `finn_lignende_hendelser`
Filtrer `hendelser.json` på tjeneste og tekst i tittel, sammendrag og rotårsak.
**Akseptkriterier**
- Søk på `tekst: "timeout"` og `tjeneste: "betaling"` gir INC-2026-037.
- Ingen treff gir en tydelig melding, ikke en tom streng.

## AP-04 `hent_tjenesteinfo` (BS-05, BS-23)
Returner beskrivelse, eier, vakt og avhengigheter fra `tjenester.json`.
**Akseptkriterier**
- Ukjent tjeneste gir feil med gyldige navn.
- Avhengigheter fra kunde-db til innlogging og betaling kan utledes (omvendt oppslag eller via full liste).

## AP-05 Alarminput og klokke (BS-03, BS-04)
`index.js` godtar alarm-ID og fritekst. Sett en «nå» som sendes til alle verktøy. `sok_i_logger` kapper `til` ved «nå». Alvorlighet leses fra alarmen.
**Akseptkriterier**
- `npm start -- ALARM-0305` bruker 03:05 som «nå» og ser ikke «loggrotasjon fullført» (03:09).
- Fritekst med «kl 03:40» gir 03:40.
- Fritekst uten klokkeslett bruker siste logglinje og sier det.

## AP-06 `lever_rapport` (BS-14)
Verktøy med skjema (se BS-14). Kallet avslutter løkka i `agent.js`, og rapporten skrives ut lesbart og returneres til kallerne (brukes av AP-11).
**Akseptkriterier**
- Skjemaet avviser rapport uten «vet ikke»-felt (kan være tom liste, men ikke utelatt).
- Løkka stopper etter `lever_rapport`.
- Utskriften skiller observert, antatt og ukjent.

## AP-07 `utfor_tiltak` (BS-07 til BS-10)
Enum med tre tiltak. Koden avviser alt annet og krever at runbooken for tiltakets tjeneste er hentet. Skriver `SIMULERT`.
**Akseptkriterier**
- Kall uten forutgående `hent_runbook` for riktig tjeneste gir `is_error` med forklaring.
- Ukjent tiltak gir feilmelding med gyldige verdier.
- Utskriften sier SIMULERT, og resultatet sier at effekten ikke kan verifiseres.

## AP-08 `varsle_vakt` (BS-11 til BS-13)
Slå opp vakt direkte i `tjenester.json` og legg teamene i `kontekst.varslet`. Tar årsakens team, alarmerende team i kopi og eventuelt Nøkkelknippe. Bruker sekundær hvis primær mangler.
**Akseptkriterier**
- 03:40 gir varsel til Team Grunnmur (Even Gravdal) med kopi til Team Portvokter.
- Ukjent team gir feil med gyldige navn.
- Utskriften sier SIMULERT.

## AP-09 Iterasjonstak (BS-15, BS-19)
Øk taket til ca. 15. Når det nås: ett siste kall med `tool_choice` mot `lever_rapport` og bare det verktøyet tilgjengelig. Merk rapporten ufullstendig. Hvis `kontekst.varslet` er tom, kaller koden `varsle_vakt` for den alarmerende tjenesten.
**Akseptkriterier**
- Med `MAX_ITERASJONER=2` får vi likevel en rapport merket ufullstendig.
- Rapporten lister hva som ikke ble sjekket.
- Uten tidligere varsel blir vakt varslet automatisk.

## AP-10 Systemprompt (BS-06, BS-08, BS-12, BS-13)
Oppdater prompten med vilkår for tiltak, varslingsregel, regelen om å sjekke runbookens dato mot loggene, og kravet om å skille observasjon fra antakelse.
**Akseptkriterier**
- Prompten nevner alle fire vilkårene fra BS-08 og varslingsregelen fra BS-12.
- Eval (AP-11) viser at 03:05 ikke varsles og 03:40 ikke utfører tiltak.

## AP-11 Fasit og eval (BS-17, BS-21, BS-22, BS-24)
Skriv `data/fasit.json` fra utkastet i `kartlegging.md`. Lag et skript som kjører alle fem alarmene og sjekker de strukturerte feltene.
**Akseptkriterier**
- Skriptet gir en oversikt per alarm med bestått/feilet og begrunnelse.
- Feller (se `kartlegging.md`) kontrolleres eksplisitt.
- Hver alarm kjøres `ANTALL_KJORINGER` ganger (standard 3) og består bare hvis alle består.
- Skriptet viser andel bestått per alarm.

## AP-12 Effort via env (BS-16)
`EFFORT` (standard `medium`) leses i `agent.js` i stedet for den hardkodede verdien. Oppdater `.env.example` og `CLAUDE.md`.
**Akseptkriterier**
- Uten variabel er oppførselen uendret.
- Ugyldig verdi gir en tydelig feilmelding ved oppstart.

## AP-13 Utvidelser (BS-01, BS-04)
Bare hvis tiden tillater. Rekkefølge etter nytte:
1. Vent-verktøy som flytter «nå» frem (maks ca. 15 min), slik at 03:05 kan avsluttes som falsk alarm.
2. Modus der agenten får alle fem alarmer og skiller uavhengige feil fra følgefeil.
3. Kodesjekk av runbookens alder mot siste endring på tjenesten.
4. LLM-dommer i evalen.
5. Enkel nettflate som viser verktøykall og rapport.
