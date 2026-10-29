// Startpunktet: npm start -- "spørsmålet ditt"
import { kjørAgent } from './agent.js';
import { system, eksempelOppgave, verktøy } from './verktoy.js';
import { lagAlarmInput } from './alarm.js';
import { lastEnv } from './miljo.js';

lastEnv();

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Mangler ANTHROPIC_API_KEY. Kopier .env.example til .env (i repoet eller mappa over) og lim inn nøkkelen.');
  process.exit(1);
}

const arg = process.argv.slice(2).join(' ') || eksempelOppgave;

let input;
try {
  input = lagAlarmInput(arg);
} catch (feil) {
  console.error(feil.message);
  process.exit(1);
}

// Oppgaveteksten inneholder også merknaden om klokkeslett, så den skrives ut sammen med den.
const { oppgave, nå, alarm } = input;
console.log(`\n🎃 ${oppgave}\n`);

await kjørAgent({ system, oppgave, verktøy, nå, alarm });
