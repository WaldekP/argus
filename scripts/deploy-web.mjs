/**
 * Wysyła zbudowany katalog `dist` na Vercela i przepina na niego stały adres
 * testowy.
 *
 * Przepięcie aliasu jest osobnym krokiem, bo `argus-pilotaz.vercel.app` to
 * alias przypięty do konkretnego wdrożenia, a nie domena projektu: sam deploy
 * podmienia tylko wygenerowany adres `dist-ebon-five-69.vercel.app`. Bez tego
 * kroku link wysłany testerom pokazywałby w nieskończoność starą wersję.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALIAS = 'argus-pilotaz.vercel.app';
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

function vercel(args, capture) {
  const result = spawnSync('npx', ['--yes', 'vercel@latest', ...args], {
    cwd: dist,
    shell: true,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result.stdout ?? '';
}

const output = vercel(['deploy', '--prod', '--yes'], true);
const url = output.match(/https:\/\/[a-z0-9-]+\.vercel\.app/gi)?.at(-1);

if (!url) {
  console.error('Nie udało się odczytać adresu wdrożenia z odpowiedzi Vercela.');
  console.error(output);
  process.exit(1);
}

vercel(['alias', 'set', url.replace('https://', ''), ALIAS], false);
console.log(`Gotowe: https://${ALIAS} pokazuje ${url}`);
