/**
 * Kontrola skladni Edge Functions bez Deno.
 *
 * Po co: `npm run check` sprawdza wylacznie `src/`. Backend typuje dopiero CI
 * (`deno check`), bo Deno uruchomione w drzewie repo zrywa symlink typescript
 * i psuje tsc, co opisuje CLAUDE.md. Efekt: blad skladni w funkcji brzegowej
 * bylo widac dopiero po pushu, po okolo dwoch minutach.
 *
 * Ten skrypt nie zastepuje `deno check`: nie rozwiazuje importow z sieci ani
 * nie sprawdza typow. Lapie warstwe nizej, czyli rzeczy, ktore w ogole nie sa
 * poprawnym TypeScriptem (niedomkniety string, nawias, literal). Dokladnie tak
 * zepsulem UA przy scalaniu adapterow mediow: `npm run check` byl zielony,
 * a CI odbilo push.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');
const KORZEN = 'backend/supabase/functions';

function pliki(dir) {
  const out = [];
  for (const wpis of readdirSync(dir)) {
    const p = join(dir, wpis);
    if (statSync(p).isDirectory()) out.push(...pliki(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

let bledy = 0;
const lista = pliki(KORZEN);
for (const p of lista) {
  const kod = readFileSync(p, 'utf8');
  const zrodlo = ts.createSourceFile(p, kod, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  // parseDiagnostics nie jest w publicznym API, ale to jedyne miejsce, w ktorym
  // TypeScript oddaje bledy skladni bez budowania calego programu.
  for (const d of zrodlo.parseDiagnostics ?? []) {
    const { line, character } = zrodlo.getLineAndCharacterOfPosition(d.start);
    const tresc = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    console.error(`${p}:${line + 1}:${character + 1}  TS${d.code}: ${tresc}`);
    bledy++;
  }
}

if (bledy > 0) {
  console.error(`\nSkladnia Edge Functions: ${bledy} blad(ow) w ${lista.length} plikach.`);
  process.exit(1);
}
console.log(`Skladnia Edge Functions: ${lista.length} plikow bez bledow.`);
