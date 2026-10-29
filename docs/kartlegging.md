# Kartlegging

Status per 29. oktober 2026, før implementasjon. Se `beslutninger.md` for hva som er besluttet og `arbeidspakker.md` for utkast til tickets.

## Status i koden

| Del | Status |
|---|---|
| `src/agent.js` agentløkke | Ferdig. Verktøykall, `is_error` ved feil, iterasjonstak, farget utskrift. |
| `src/index.js` | Leser alarmtekst fra argv. Leser **ikke** `data/alarmer.json`. |
| `sok_i_logger` | Live. |
| `hent_runbook`, `sjekk_deploy_historikk`, `finn_lignende_hendelser` | Stubber (`kjør: null`). TODO-kommentarene beskriver implementasjonen. |
| `tjenester.json` | Ingen verktøy bruker den. |
| Systemprompt | Generell. Sier ikke noe om tiltak, varsling eller rapportformat utover fritekst. |
| Rapport | Fritekst. Ingen rapport hvis `MAX_ITERASJONER` nås. |
| Tiltak og varsling | Finnes ikke. |
| Eval, fasit, tester | Finnes ikke. |
| Tidsmodell | Ingen «nå». Verktøyene ser alle logger til 03:50, også etter alarmtidspunktet. |

## Gap mot besluttet løsning

1. Tre stubber må implementeres.
2. Nytt: verktøy for tjenesteinfo, tiltak, varsling og rapport.
3. Alarminput via ID og en klokke («nå») som kapper alle verktøy.
4. Oppdatert systemprompt med vilkår for tiltak, varslingsregel og ærlighetskrav.
5. Håndtering av iterasjonstak.
6. Fasit og eval.

## Hva dataene ser ut til å si

Dette er en lesning av loggene, deploy-historikken og runbookene. Den skal verifiseres mot agentens faktiske utredning og er ikke fasit før den er lagt i `data/fasit.json`.

| Alarm | Alvorlighet | Sannsynlig årsak | Feller |
|---|---|---|---|
| 03:05 innlogging, disk 91 % | advarsel | Loggrotasjon startet 03:00. Kjent mønster (INC-2026-004, -026), går over ca. 03:09. | Å gjøre noe med disken. Runbooken ber om sletting først etter 03:20. |
| 03:12 betaling, 5xx 9,4 % | kritisk | Release 2.14.0 kl 02:51. `TypeError` på `valuta` for utenlandske kort. Feilene starter 02:52. Runbook (20/8): rollback. | Kortnett-treghet (INC-2026-037). Ingen Kortnett-symptomer i loggene. |
| 03:20 sok, p95 4,6 s | høy | Nattlig reindeks startet 03:00 som fullindeks. Heap og GC-pauser på sok-node-2 (INC-2026-031). Runbook (27/6): pause reindeks. | Klient 10.4.7.22 som rate-limites i gatewayen (INC-2026-044) er støy. Synonymlista (27/10) og ny rangering (23/10) er avledende. |
| 03:31 varsling, SMS 58 % | høy | Timeouts og HTTP 429 mot SmsBud. Ny retry-policy fra 26/10 (5 forsøk, kort pause) kan forsterke. Kø over 1000. | Å si «SmsBud er nede» eller «retry-policyen er årsaken» uten å ha belegg for det. Rotårsaken er trolig uavklart. |
| 03:40 api-gateway, 504 17,2 % | kritisk | `VACUUM FULL sesjoner` kl 03:30 tar `AccessExclusiveLock`. Innlogging henger, tilkoblingene til kunde-db går tom (198/200, så FATAL). Cron flyttet til torsdag 03:30 den 22/10 (i dag er torsdag). | Gateway-konfigen 28/10 gjelder bare `/api/rapport`. `kunde-db.md` er utdatert (pgbouncer er fjernet, vedlikehold står som søndag 04:00). Restart av pgbouncer er feil tiltak. |

Det finnes ingen runbook for api-gateway.

## Forventet utfall med vedtatte regler

Utledet fra beslutningene BS-06 til BS-13. Dette er et utkast til fasiten.

| Alarm | Tiltak | Varsling |
|---|---|---|
| 03:05 | Ingen | Ingen. Rapport: kjent mønster, forventes å gå over innen ca. 03:10, sjekk igjen. |
| 03:12 | `rollback_betaling` | Ja, fordi alarmen er kritisk. Team Myntkammer. |
| 03:20 | `pause_reindeks_sok` | Nei. Runbooken sier at ingen trenger å vekkes hvis pausen virker. |
| 03:31 | `pause_leveringsvarsler` (kø over 1000). Dempingen er delvis. | Ja, fordi årsaken er usikker. Team Ugla, og Team Nøkkelknippe fordi engangskoder er rammet. |
| 03:40 | Ingen. Gateway har ingen runbook, og kunde-db-runbooken er utdatert. | Ja. Team Grunnmur (årsak), Team Portvokter i kopi. |

## Andre observasjoner

- Datoer i deploy-historikken bruker `+02:00` før 25. oktober og `+01:00` etter. `tilMs` håndterer bare `+01:00` for klokkeslett uten dato. Det er riktig for natten til 29/10.
- `CLAUDE.md` og `.claude/` er ikke committet.
- `.env` er gitignored og ble ikke lest under kartleggingen.
