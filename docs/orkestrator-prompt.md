# Orkestrator-prompt

Lim innholdet under i en ny Claude Code-sesjon for å orkestrere implementasjonen av alle arbeidspakkene.

Før kjøring:
- Prompten forutsetter at orkestratoren fletter worktree-grenene inn. Kjøres alt i samme mappe, må sporene kjøres sekvensielt, ellers overskriver de hverandre i `agent.js` og `verktoy.js`.
- Evalen (AP-11) og prompt-justeringen (AP-10) trenger `ANTHROPIC_API_KEY` og koster tokens. Hver eval kjører 5 alarmer × 3 ganger.

---

```text
Du er orkestrator for implementasjonen av «Natteskiftet». Les først CLAUDE.md, docs/kartlegging.md, docs/beslutninger.md og docs/arbeidspakker.md. Beslutningene (BS-xx) er bindende. Avvik skal meldes tilbake, ikke gjøres på egen hånd.

Gjør dette i rekkefølge:

1. AP-00 først, sekvensielt, av én subagent (isolation: "worktree"). Fortsett ikke før den er flettet inn i hovedgrenen og `npm start` oppfører seg som før.
2. Start deretter fem spor parallelt som subagents, hver i egen worktree:
   - A: AP-01, AP-02, AP-03, AP-04
   - B: AP-05
   - C: AP-06, deretter AP-09 og AP-12 (samme agent, fordi alle rører agent.js)
   - D: AP-07 og AP-08
   - E: AP-11 delen `data/fasit.json` (fra utkastet i kartlegging.md)
3. Når A–E er flettet inn: kjør AP-11-skriptet (eval), deretter AP-10 (systemprompt) som én agent. Iterer på prompten til evalen består, men endre ikke fasiten for å få den til å bestå.

Regler for hver subagent:
- Gi den bare sin pakke, relevante BS-er og filene den skal røre. Be den holde seg innenfor pakkens akseptkriterier.
- Kode, identifikatorer og verktøybeskrivelser på norsk. Verktøynavn er ASCII. Skriv kode som ser ut som den eksisterende, med samme kommentartetthet.
- Subagenten skal verifisere akseptkriteriene sine ved å kjøre koden, og rapportere hva som faktisk ble kjørt og resultatet. Ingen API-kall mot Anthropic uten at pakken krever det.
- Rapporter feil og hoppede steg som de er.

Som orkestrator:
- Gå gjennom hver subagents diff mot akseptkriteriene før du fletter inn. Meld konflikter og avvik til meg.
- Ikke commit eller push uten at jeg ber om det. Ikke les eller skriv .env.
- Avslutt med en statusoppsummering per AP: ferdig, delvis eller ikke gjort, og hva som er verifisert ved kjøring.
```
