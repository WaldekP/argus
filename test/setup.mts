/**
 * Konfiguracja testów jednostkowych (`npm test`).
 *
 * Testy odpalamy wbudowanym runnerem Node (`node --test`) na plikach .ts bez
 * kompilacji: Node 24 sam zdejmuje typy. Zero zależności deweloperskich, ten
 * sam mechanizm, z którego korzysta `tools/bip-scraper`.
 *
 * Node rozwiązuje jednak ścieżki po regułach ESM, a kod aplikacji pisany jest
 * pod resolver Metro/TypeScript: importy bez rozszerzenia (`./types`) i alias
 * `@/` na katalog `src`. Ten hook domyka tę różnicę, żeby produkcyjne pliki
 * nie musiały wiedzieć, że są testowane.
 *
 * Zakres: testujemy logikę czystą (formatowanie, normalizacja odpowiedzi API,
 * spójność bazy wiedzy). Komponentów React Native tu nie renderujemy, bo
 * wymagałyby środowiska Expo i przenoszą test z logiki na framework.
 */

import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '..', 'src');

/** Rozszerzenia sprawdzane w kolejności, tak jak robi to resolver TypeScriptu. */
const CANDIDATES = ['.ts', '.tsx', '.js', '/index.ts', '/index.tsx'];

/** Pierwszy istniejący plik dla ścieżki bez rozszerzenia. */
function resolveFile(basePath: string): string | null {
  if (existsSync(basePath) && path.extname(basePath)) return basePath;
  for (const suffix of CANDIDATES) {
    const candidate = basePath + suffix;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // Alias @/ z tsconfig.json wskazuje na src/.
    if (specifier.startsWith('@/')) {
      const target = resolveFile(path.join(SRC, specifier.slice(2)));
      if (target) return { url: pathToFileURL(target).href, shortCircuit: true };
    }

    // Import relatywny bez rozszerzenia: dopisz je tak jak Metro.
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const target = resolveFile(path.resolve(parentDir, specifier));
      if (target) return { url: pathToFileURL(target).href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});
