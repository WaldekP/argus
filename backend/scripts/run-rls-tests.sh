#!/usr/bin/env bash
# Odpala testy RLS (backend/supabase/tests/rls_tests.sql) na zdalnej bazie
# przez Supabase Management API. Wymaga SUPABASE_ACCESS_TOKEN w env
# (np. source .env w rootcie repo). Testy same sprzątają po sobie (rollback).
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-jgwvtlghpkztivbhnofi}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/../supabase/tests/rls_tests.sql"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Brak SUPABASE_ACCESS_TOKEN w env (source .env w rootcie repo)." >&2
  exit 1
fi

BODY=$(python3 -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' "$SQL_FILE")

HTTP_CODE=$(curl -s -o /tmp/rls_test_result.json -w "%{http_code}" \
  -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY")

echo "HTTP $HTTP_CODE"
cat /tmp/rls_test_result.json
echo
if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo "TESTY RLS NIE PRZESZLY" >&2
  exit 1
fi
