#!/usr/bin/env bash
# Generuje backend/supabase/functions/_shared/prompts/index.ts z plikow .md.
# `supabase functions deploy` NIE bundluje plikow .md (eszip zawiera tylko
# importowane moduly), wiec prompty musza byc modulem TS. Zrodlem prawdy sa
# pliki .md — po kazdej zmianie promptu odpal ten skrypt i zdeployuj funkcje.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="$SCRIPT_DIR/../supabase/functions/_shared/prompts"

python3 - "$PROMPTS_DIR" <<'EOF'
import pathlib
import sys

prompts_dir = pathlib.Path(sys.argv[1])
entries = []
for md in sorted(prompts_dir.glob("*.md")):
    if md.name == "README.md":
        continue
    text = md.read_text(encoding="utf-8")
    escaped = text.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
    entries.append(f'  "{md.stem}": `{escaped}`,')

out = (
    "// PLIK GENEROWANY — nie edytuj recznie.\n"
    "// Zrodlo: pliki .md w tym katalogu; regeneracja: backend/scripts/build-prompts.sh\n"
    "// (deploy Edge Functions nie bundluje .md, dlatego prompty sa modulem TS).\n\n"
    "export const prompts: Record<string, string> = {\n"
    + "\n".join(entries)
    + "\n};\n"
)
(prompts_dir / "index.ts").write_text(out, encoding="utf-8")
print(f"Wygenerowano index.ts ({len(entries)} promptow)")
EOF
