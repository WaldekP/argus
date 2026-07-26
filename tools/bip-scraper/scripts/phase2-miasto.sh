#!/usr/bin/env bash
# Etap 2: gleboki crawl podmiotow miejskich bip.gdansk.pl.
#
# Uruchamiac DOPIERO po wyczerpaniu glownego crawla (poller drained.mjs).
# Uruchom w tle. Wznawialny: przy przerwaniu odpal ponownie, pominie zrobione.
#
# Kolejnosc: Urzad Miejski pierwszy (uderzyl w limit 300 w glownym crawlu),
# potem trzy pozostale. Limit 10000 stron i glebokosc 6 = realnie bez limitu
# dla tego serwisu. Juz pobrane dokumenty nie sciagaja sie drugi raz.
set -u
cd "/c/GitHub projects/argus/tools/bip-scraper" || exit 1

CITY_IDS="113387 118032 124181 139288"   # Urzad Miejski, Zarzad Drog, GCI, Zarzad Zieleni

echo "=== ETAP 2 start ==="
for id in $CITY_IDS; do
  echo "--- reset $id"
  node --no-warnings src/cli.ts reset --entity "$id"
done

for id in $CITY_IDS; do
  echo "--- gleboki crawl $id"
  node --no-warnings src/cli.ts crawl --entity "$id" --max-pages 10000 --max-depth 6
done

echo "=== ETAP 3: extract + index ==="
node --no-warnings src/cli.ts extract
node --no-warnings src/cli.ts index

echo "=== ETAP 2+3 ZAKONCZONE ==="
