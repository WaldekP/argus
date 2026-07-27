// Lokalny frontend do przegladania zaleznosci. Zero zaleznosci: wbudowany http
// serwuje JSON API + jednoplikowy UI (vanilla JS). Baza otwierana READ-ONLY,
// zeby nie kolidowac z ewentualnym zapisem (ingest/OCR) w innym procesie.

import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";

function openRo(): DatabaseSync {
  return new DatabaseSync(config.dbPath, { readOnly: true });
}

function json(res: http.ServerResponse, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function api(db: DatabaseSync, path: string, params: URLSearchParams): unknown {
  if (path === "/api/summary") {
    return {
      notices: (db.prepare("SELECT COUNT(*) c FROM notices").get() as { c: number }).c,
      results: (db.prepare("SELECT COUNT(*) c FROM notices WHERE notice_type='TenderResultNotice'").get() as { c: number }).c,
      winners: (db.prepare("SELECT COUNT(DISTINCT COALESCE(nip,name)) c FROM contractors").get() as { c: number }).c,
      people: (db.prepare("SELECT COUNT(*) c FROM people").get() as { c: number }).c,
      declOcr: (db.prepare("SELECT COUNT(*) c FROM declaration_text WHERE status='ocr_ok'").get() as { c: number }).c,
      leads: (db.prepare("SELECT COUNT(*) c FROM leads").get() as { c: number }).c,
    };
  }
  if (path === "/api/leads") {
    const kind = params.get("kind");
    const where = kind ? "WHERE l.kind = ?" : "";
    const rows = db.prepare(`
      SELECT l.id, p.name person, p.role, p.year, l.contractor_name, l.contractor_nip,
             l.kind, l.confidence, l.wins, l.snippet
      FROM leads l JOIN people p ON p.id = l.person_id
      ${where}
      ORDER BY CASE l.kind WHEN 'deklaracja' THEN 0 ELSE 1 END, l.wins DESC
      LIMIT 500
    `).all(...(kind ? [kind] : []));
    return rows;
  }
  if (path === "/api/search") {
    const q = (params.get("q") ?? "").trim();
    if (q.length < 3) return { declarations: [], winners: [], note: "min. 3 znaki" };
    const like = `%${q}%`;
    // Deklaracje urzednikow zawierajace fraze (OCR bywa szumny; szukaj wyroznialnie).
    const declarations = db.prepare(`
      SELECT p.name person, p.role, p.year, dt.text
      FROM declaration_text dt JOIN person_files pf ON pf.id = dt.person_file_id
      JOIN people p ON p.id = pf.person_id
      WHERE dt.status='ocr_ok' AND dt.text LIKE ? LIMIT 50
    `).all(like) as { person: string; role: string; year: number; text: string }[];
    const declOut = declarations.map((d) => {
      const i = d.text.toLowerCase().indexOf(q.toLowerCase());
      return {
        person: d.person, role: d.role, year: d.year,
        snippet: i >= 0 ? d.text.slice(Math.max(0, i - 60), i + 100).replace(/\s+/g, " ").trim() : "",
      };
    });
    const winners = db.prepare(`
      SELECT name, nip, COUNT(*) wins FROM contractors
      WHERE name LIKE ? GROUP BY COALESCE(nip, name) ORDER BY wins DESC LIMIT 50
    `).all(like);
    return { declarations: declOut, winners };
  }
  if (path === "/api/winners") {
    const q = params.get("q") ?? "";
    const rows = db.prepare(`
      SELECT name, nip, COUNT(*) wins FROM contractors
      WHERE name LIKE ? GROUP BY COALESCE(nip, name) ORDER BY wins DESC LIMIT 200
    `).all(`%${q}%`);
    return rows;
  }
  if (path === "/api/winner") {
    const name = params.get("name") ?? "";
    const rows = db.prepare(`
      SELECT n.bzp_number, n.publication_date, n.order_object, n.procedure_result, n.org_name, n.year
      FROM contractors c JOIN notices n ON n.bzp_number = c.bzp_number
      WHERE c.name = ? ORDER BY n.publication_date DESC LIMIT 200
    `).all(name);
    return rows;
  }
  if (path === "/api/people") {
    const q = params.get("q") ?? "";
    const rows = db.prepare(`
      SELECT p.id, p.name, p.role, p.year,
        (SELECT COUNT(*) FROM person_files f WHERE f.person_id=p.id) files,
        (SELECT COUNT(*) FROM leads l WHERE l.person_id=p.id) leads
      FROM people p WHERE p.name LIKE ? ORDER BY p.role, p.name LIMIT 300
    `).all(`%${q}%`);
    return rows;
  }
  if (path === "/api/person") {
    const id = Number(params.get("id"));
    const person = db.prepare("SELECT id, name, role, year, page_url FROM people WHERE id=?").get(id);
    const files = db.prepare(`
      SELECT pf.url, dt.status, dt.conf, dt.text
      FROM person_files pf LEFT JOIN declaration_text dt ON dt.person_file_id = pf.id
      WHERE pf.person_id = ?
    `).all(id);
    return { person, files };
  }
  return { error: "nieznany endpoint" };
}

export function runServe(port: number): void {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(PAGE);
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      const db = openRo();
      try {
        json(res, api(db, url.pathname, url.searchParams));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      } finally {
        db.close();
      }
      return;
    }
    res.writeHead(404);
    res.end("nie znaleziono");
  });
  server.listen(port, () => {
    console.log(`Frontend zamowien: http://localhost:${port}`);
    console.log("Ctrl+C konczy. Baza otwierana read-only.");
  });
}

const PAGE = `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zamówienia Gdańsk — zależności</title>
<style>
  :root { --bg:#0f1420; --panel:#171e2e; --line:#26304a; --tx:#e7ecf5; --muted:#93a0bd; --gold:#e6c65a; --accent:#5b9bd5; --alert:#e0705a; }
  * { box-sizing:border-box; } body { margin:0; font:15px/1.5 system-ui,Segoe UI,Roboto,sans-serif; background:#0f1420; color:#e7ecf5; }
  header { padding:14px 20px; border-bottom:1px solid #26304a; display:flex; gap:20px; align-items:baseline; flex-wrap:wrap; }
  h1 { font-size:18px; margin:0; font-weight:600; }
  .sub { color:#93a0bd; font-size:13px; }
  nav { display:flex; gap:6px; padding:10px 20px; border-bottom:1px solid #26304a; }
  nav button { background:#171e2e; color:#e7ecf5; border:1px solid #26304a; padding:7px 14px; border-radius:8px; cursor:pointer; font-size:14px; }
  nav button.on { background:#5b9bd5; border-color:#5b9bd5; color:#0f1420; font-weight:600; }
  main { padding:18px 20px; max-width:1200px; }
  input[type=search] { background:#171e2e; border:1px solid #26304a; color:#e7ecf5; padding:8px 12px; border-radius:8px; width:320px; margin-bottom:14px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th,td { text-align:left; padding:8px 10px; border-bottom:1px solid #26304a; vertical-align:top; }
  th { color:#93a0bd; font-weight:500; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  tr.clk:hover { background:#171e2e; cursor:pointer; }
  .pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid #26304a; }
  .c-srednia { color:#e6c65a; border-color:#e6c65a55; } .c-niska { color:#93a0bd; } .c-wysoka { color:#e0705a; border-color:#e0705a55; }
  .snip { color:#93a0bd; font-size:13px; font-style:italic; }
  .stat { display:flex; gap:22px; color:#93a0bd; font-size:13px; }
  .stat b { color:#e7ecf5; font-size:16px; }
  a { color:#5b9bd5; } .note { color:#e6c65a; font-size:13px; margin:8px 0 16px; }
  #detail { position:fixed; top:0; right:0; width:min(560px,92vw); height:100vh; background:#171e2e; border-left:1px solid #26304a; padding:20px; overflow:auto; transform:translateX(100%); transition:.2s; }
  #detail.open { transform:none; box-shadow:-20px 0 60px #0008; }
  #detail h2 { font-size:16px; margin:0 0 4px; } #detail .x { float:right; cursor:pointer; color:#93a0bd; }
  pre { white-space:pre-wrap; background:#0f1420; padding:10px; border-radius:8px; font-size:12px; color:#c3ccdd; max-height:320px; overflow:auto; }
</style></head><body>
<header><h1>Zamówienia Gdańsk — zależności</h1><div class="stat" id="stat"></div></header>
<nav>
  <button data-v="search" class="on">Szukaj krzyżowo</button>
  <button data-v="people">Urzędnicy</button>
  <button data-v="winners">Zwycięzcy</button>
  <button data-v="leads">Powiązania (eksp.)</button>
</nav>
<main id="main"></main>
<div id="detail"></div>
<script>
const M=document.getElementById('main'),D=document.getElementById('detail');
const esc=s=>(s==null?'':String(s)).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
async function j(u){return (await fetch(u)).json();}
async function stat(){const s=await j('/api/summary');document.getElementById('stat').innerHTML=
 \`<span><b>\${s.notices}</b> ogłoszeń</span><span><b>\${s.winners}</b> firm-zwycięzców</span><span><b>\${s.people}</b> urzędników</span><span><b>\${s.declOcr}</b> deklaracji OCR</span><span><b>\${s.leads}</b> powiązań</span>\`;}
function closeD(){D.classList.remove('open');}
function openD(html){D.innerHTML='<span class="x" onclick="closeD()">zamknij ✕</span>'+html;D.classList.add('open');}

async function viewSearch(){
 M.innerHTML='<div class="note">Wyszukiwarka krzyżowa: wpisz nazwę firmy albo nazwisko. Pokaże, gdzie termin występuje w OŚWIADCZENIACH urzędników i wśród ZWYCIĘZCÓW przetargów. To najpewniejszy sposób łączenia (termin wybierasz Ty, więc bez szumu automatu). OCR skanów bywa niedokładny, więc szukaj wyróżniających członów nazwy.</div>'+
  '<input type="search" id="q" placeholder="np. INNOBALTICA, Motława, nazwisko…" autofocus><div id="r"></div>';
 const load=async()=>{const q=document.getElementById('q').value.trim();const R=document.getElementById('r');
  if(q.length<3){R.innerHTML='<p class="sub">Wpisz co najmniej 3 znaki.</p>';return;}
  const d=await j('/api/search?q='+encodeURIComponent(q));
  R.innerHTML='<h3>W oświadczeniach urzędników ('+d.declarations.length+')</h3>'+
   (d.declarations.length?'<table><tr><th>Urzędnik</th><th>Rola</th><th>Fragment oświadczenia</th></tr>'+
    d.declarations.map(x=>'<tr><td>'+esc(x.person)+'</td><td>'+esc(x.role||'')+'</td><td class="snip">'+esc(x.snippet)+'</td></tr>').join('')+'</table>':'<p class="sub">Brak w oświadczeniach.</p>')+
   '<h3>Wśród zwycięzców przetargów ('+d.winners.length+')</h3>'+
   (d.winners.length?'<table><tr><th>Firma</th><th>NIP</th><th>Wygrane</th></tr>'+
    d.winners.map(x=>'<tr class="clk" onclick=\\'winner('+JSON.stringify(x.name)+')\\'><td>'+esc(x.name)+'</td><td>'+esc(x.nip||'')+'</td><td><b>'+x.wins+'</b></td></tr>').join('')+'</table>':'<p class="sub">Brak wśród zwycięzców.</p>')+
   (d.declarations.length&&d.winners.length?'<div class="note">Termin występuje PO OBU stronach — potencjalne powiązanie do weryfikacji przy skanie źródłowym.</div>':'');
 };
 document.getElementById('q').oninput=load;
}
async function viewLeads(){
 M.innerHTML='<div class="note">Warstwa EKSPERYMENTALNA i szumna: automat parował nazwy z tekstem OCR deklaracji, co przy skanach daje sporo błędnych par. Traktuj jako surowe tropy, weryfikuj przez snippet i skan. Pewniejsza jest zakładka „Szukaj krzyżowo".</div><div id="t">ładowanie…</div>';
 const r=await j('/api/leads');
 document.getElementById('t').innerHTML=r.length?\`<table><tr><th>Urzędnik</th><th>Rola</th><th>Firma (wygrane)</th><th>Typ</th><th>Dowód</th></tr>\`+
  r.map(x=>\`<tr><td>\${esc(x.person)}</td><td>\${esc(x.role||'')}</td><td>\${esc(x.contractor_name)} <b>(\${x.wins})</b></td><td><span class="pill c-\${x.confidence}">\${x.kind}</span></td><td class="snip">\${esc(x.snippet||'')}</td></tr>\`).join('')+'</table>'
  :'<p>Brak powiązań. Uruchom: <code>node src/cli.ts match</code> (po OCR deklaracji).</p>';
}
async function viewWinners(){
 M.innerHTML='<input type="search" id="q" placeholder="szukaj firmy…"><div id="t"></div>';
 const load=async()=>{const r=await j('/api/winners?q='+encodeURIComponent(document.getElementById('q').value));
  document.getElementById('t').innerHTML=\`<table><tr><th>Firma</th><th>NIP</th><th>Wygrane</th></tr>\`+
   r.map(x=>\`<tr class="clk" onclick='winner(\${JSON.stringify(x.name)})'><td>\${esc(x.name)}</td><td>\${esc(x.nip||'')}</td><td><b>\${x.wins}</b></td></tr>\`).join('')+'</table>';};
 document.getElementById('q').oninput=load; load();
}
async function winner(name){const r=await j('/api/winner?name='+encodeURIComponent(name));
 openD(\`<h2>\${esc(name)}</h2><div class="sub">\${r.length} postępowań</div><table>\`+
  r.map(x=>\`<tr><td>\${esc(x.publication_date||'').slice(0,10)}<br><span class="snip">\${esc(x.org_name)}</span></td><td>\${esc((x.order_object||'').slice(0,120))}</td></tr>\`).join('')+'</table>');}
async function viewPeople(){
 M.innerHTML='<input type="search" id="q" placeholder="szukaj urzędnika…"><div id="t"></div>';
 const load=async()=>{const r=await j('/api/people?q='+encodeURIComponent(document.getElementById('q').value));
  document.getElementById('t').innerHTML=\`<table><tr><th>Nazwisko</th><th>Rola</th><th>Rok</th><th>Deklaracje</th><th>Powiązania</th></tr>\`+
   r.map(x=>\`<tr class="clk" onclick="person(\${x.id})"><td>\${esc(x.name)}</td><td>\${esc(x.role||'')}</td><td>\${x.year||''}</td><td>\${x.files}</td><td>\${x.leads?('<b>'+x.leads+'</b>'):'0'}</td></tr>\`).join('')+'</table>';};
 document.getElementById('q').oninput=load; load();
}
async function person(id){const r=await j('/api/person?id='+id);const p=r.person;
 openD(\`<h2>\${esc(p.name)}</h2><div class="sub">\${esc(p.role||'')} · \${p.year||''} · <a href="\${esc(p.page_url)}" target="_blank">strona BIP</a></div>\`+
  r.files.map(f=>\`<p><a href="\${esc(f.url)}" target="_blank">skan oświadczenia (PDF)</a> \${f.status?('· OCR '+f.status+' '+(f.conf?Math.round(f.conf)+'%':'')):''}</p>\`+(f.text?\`<pre>\${esc(f.text.slice(0,3000))}</pre>\`:'')).join(''));}

const views={search:viewSearch,leads:viewLeads,winners:viewWinners,people:viewPeople};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('nav button').forEach(x=>x.classList.remove('on'));b.classList.add('on');closeD();views[b.dataset.v]();});
stat(); viewSearch();
</script></body></html>`;
