// Spis podmiotow BIP z gov.pl: ZIP z plikiem subjects.xml (~13 tys. wierszy).
//
// Format wiersza (stan na 2026-07): <row> z polami m.in. id, name, url,
// place, parentId oraz zagniezdzonym <communeTercCode><code>. Filtrujemy
// po prefiksie TERC (Gdansk: 2261) lub po nazwie miejscowosci.

import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso } from "./db.ts";
import { fetchUrl } from "./fetcher.ts";
import { unzip } from "./zip.ts";
import { blocks, tagValue } from "./xml.ts";

interface RegistryRow {
  id: number;
  name: string;
  url: string | null;
  terc: string | null;
  place: string | null;
  parentId: number | null;
}

function parseRows(xml: string): RegistryRow[] {
  const rows: RegistryRow[] = [];
  for (const block of blocks(xml, "row")) {
    const id = Number(tagValue(block, "id"));
    const name = tagValue(block, "name");
    if (!Number.isFinite(id) || !name) continue;
    rows.push({
      id,
      name,
      url: tagValue(block, "url"),
      terc: tagValue(block, "code"),
      place: tagValue(block, "place"),
      parentId: Number(tagValue(block, "parentId")) || null,
    });
  }
  return rows;
}

/** Host i prefiks sciezki wyznaczajace zakres crawla podmiotu. */
function scopeOf(url: string): { host: string; pathPrefix: string } | null {
  try {
    const u = new URL(url);
    let prefix = u.pathname.replace(/\/+$/, "");
    // Prefiks typu /web/uw-pomorski zostaje; pojedynczy plik (cos.html) nie
    // jest sensownym prefiksem, wiec bierzemy katalog nadrzedny.
    if (/\.[a-z0-9]{2,5}$/i.test(prefix)) prefix = prefix.replace(/\/[^/]*$/, "");
    return { host: u.hostname, pathPrefix: prefix || "/" };
  } catch {
    return null;
  }
}

export async function runRegistry(
  db: DatabaseSync,
  opts: { tercPrefix?: string; place?: string },
): Promise<void> {
  const tercPrefix = opts.tercPrefix ?? config.tercPrefix;
  console.log(`Pobieram spis podmiotow: ${config.registryUrl}`);
  const res = await fetchUrl(config.registryUrl);
  if (res.status !== 200) throw new Error(`Spis: HTTP ${res.status}`);

  const files = unzip(res.body);
  const xmlEntry = [...files.keys()].find((n) => n.toLowerCase().endsWith(".xml"));
  if (!xmlEntry) throw new Error("Spis: w archiwum nie ma pliku XML");
  const rows = parseRows(files.get(xmlEntry)!.toString("utf8"));
  console.log(`Wierszy w spisie: ${rows.length}`);

  const wanted = rows.filter((r) => {
    if (opts.place) return r.place?.toLowerCase() === opts.place.toLowerCase();
    return r.terc?.startsWith(tercPrefix) ?? false;
  });
  console.log(
    `Po filtrze (${opts.place ? `place=${opts.place}` : `terc=${tercPrefix}*`}): ${wanted.length}`,
  );

  const insert = db.prepare(`
    INSERT INTO entities (id, name, url, host, path_prefix, terc, place, parent_id, added_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, url = excluded.url,
      host = excluded.host, path_prefix = excluded.path_prefix,
      terc = excluded.terc, place = excluded.place, parent_id = excluded.parent_id
  `);

  let noUrl = 0;
  for (const row of wanted) {
    const scope = row.url ? scopeOf(row.url) : null;
    if (!scope) noUrl++;
    insert.run(
      row.id,
      row.name,
      row.url,
      scope?.host ?? null,
      scope?.pathPrefix ?? null,
      row.terc,
      row.place,
      row.parentId,
      nowIso(),
    );
  }
  console.log(`Zapisano podmiotow: ${wanted.length} (bez poprawnego URL: ${noUrl})`);
}
