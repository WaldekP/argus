/**
 * Dokłada do świeżego `dist/` dwa pliki, których `expo export` nie zna:
 * konfigurację routingu Vercela i dowiązanie do właściwego projektu.
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

mkdirSync(join(dist, '.vercel'), { recursive: true });
writeFileSync(join(dist, '.vercel', 'project.json'), JSON.stringify(project, null, 2));

console.log('dist: dołożono vercel.json i dowiązanie do projektu', project.projectName);
