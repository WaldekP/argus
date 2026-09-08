/**
 * Dokłada do świeżego `dist/` trzy pliki, których `expo export` nie zna:
 * konfigurację routingu Vercela, listę wyjątków od pomijania plików
 * i dowiązanie do właściwego projektu.
 *
 * Dowiązanie jest tu nie bez powodu. `expo export` kasuje cały katalog `dist`
 * razem z `dist/.vercel/`, więc bez tego kroku Vercel CLI nie wie, do którego
 * projektu wysyła, zgaduje po nazwie katalogu i zakłada nowy projekt „dist".
 * Raz już tak zrobił.
 */

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const project = {
  projectId: 'prj_XLetKQrisvm3Wbp1bqKcIiZbkOI8',
  orgId: 'team_o3hxFzHJa3gRZb7VIjMzXFWB',
  projectName: 'argus',
};

copyFileSync(join(root, 'scripts', 'vercel-static.json'), join(dist, 'vercel.json'));

// Vercel pomija przy wysyłce każdy katalog o nazwie `node_modules`, a `expo
// export` składa właśnie tam wszystkie fonty: ikony Ionicons, Inter
// i Cormorant Garamond lądują w `dist/assets/node_modules/`. Bez tej negacji
// pliki .ttf nie jadą na serwer, przeglądarka dostaje w zamian `index.html`
// (bo reguła SPA łapie każdą nieznaną ścieżkę), więc każda ikona w aplikacji
// renderuje się jako pusty kwadrat, a teksty lecą na krojach zastępczych.
// Objaw w konsoli: „OTS parsing error: invalid sfntVersion: 1008813135",
// czyli bajty „<!DO" tam, gdzie miał być nagłówek fontu.
writeFileSync(
  join(dist, '.vercelignore'),
  ['!assets/node_modules', '!assets/node_modules/**', ''].join('\n')
);

mkdirSync(join(dist, '.vercel'), { recursive: true });
writeFileSync(join(dist, '.vercel', 'project.json'), JSON.stringify(project, null, 2));

console.log('dist: dołożono vercel.json, .vercelignore i dowiązanie do projektu', project.projectName);
