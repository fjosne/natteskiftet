// Verktøyene til natteskift-agenten. Et verktøy er en definisjon (det modellen
// ser) og en kjør-funksjon (det som faktisk skjer). kjør: null betyr stub: den
// sendes ikke til modellen før dere implementerer den.
import sokILogger from './verktoy/sok_i_logger.js';
import hentRunbook from './verktoy/hent_runbook.js';
import sjekkDeployHistorikk from './verktoy/sjekk_deploy_historikk.js';
import finnLignendeHendelser from './verktoy/finn_lignende_hendelser.js';
import leverRapport from './verktoy/lever_rapport.js';

export const system = `Du tar første vakt når en alarm går om natta, før et menneske rekker å åpne laptopen.
Grav i loggene og de andre kildene til du har en hypotese om hva som skjer og hvorfor.
Skill mellom det du har sett i dataene og det du antar. Si eksplisitt hva du ikke vet.
En agent som gjetter på et produksjonsproblem er verre enn ingen agent.
Avslutt med en kort situasjonsrapport på norsk: alvorlighet, berørt tjeneste, sannsynlig årsak, hva du ikke vet, og foreslått neste steg.`;

export const eksempelOppgave =
  'ALARM kl 03:12 natt til 29. oktober: betaling: andel 5xx-svar siste 5 min er 9.4 % (terskel 5 %). Gjelder POST /betaling/trekk.';

export const verktøy = [sokILogger, hentRunbook, sjekkDeployHistorikk, finnLignendeHendelser, leverRapport];
