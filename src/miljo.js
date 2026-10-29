// Laster .env: først fra repoet, ellers fra mappa over (når repoet ligger inni et foreldrerepo).
import path from 'node:path';

const ROT = path.join(import.meta.dirname, '..');

export function lastEnv() {
  for (const fil of [path.join(ROT, '.env'), path.join(ROT, '..', '.env')]) {
    try {
      process.loadEnvFile(fil);
      return fil;
    } catch {
      // Finnes ikke her, prøv neste.
    }
  }
  // Ingen .env — da må ANTHROPIC_API_KEY være satt i miljøet.
  return null;
}
