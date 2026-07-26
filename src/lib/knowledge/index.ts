/**
 * Rejestr tematów programowych. Każdy temat to osobny moduł w topics/,
 * kuratorowany ręcznie (research, audyt, oznaczenie danych do weryfikacji).
 * Kolejność w tablicy = kolejność na liście w aplikacji.
 *
 * Docelowo źródłem będzie tabela knowledge_topics z bazy; typy są już
 * docelowe, więc podmiana nie ruszy ekranów.
 */

import type { Temat } from './types';
import { kwotaWolna } from './topics/kwota-wolna';
import { kwotaWolna12x } from './topics/kwota-wolna-12x';
import { pitLiniowy } from './topics/pit-liniowy';
import { podatekBelki } from './topics/podatek-belki';
import { dobrowolnyZus } from './topics/dobrowolny-zus';
import { uproszczenia } from './topics/uproszczenia-przedsiebiorcy';
import { skladkaZdrowotna } from './topics/skladka-zdrowotna';
import { konsolidacjaFiskalna } from './topics/konsolidacja-fiskalna';
import { transfery800plus } from './topics/transfery-800plus';
import { euro } from './topics/euro';
import { obronnosc } from './topics/obronnosc';
import { klimatEnergia } from './topics/klimat-energia';

/**
 * Kolejność na liście. Najpierw kwota wolna i pięć punktów programu
 * podatkowego Konfederacji 2023 (korpus docs/konfederacja-podatki/), potem
 * sześć tematów z planu wyborczego dla Petru (korpus docs/plan-wyborczy-petru/):
 * składka zdrowotna, konsolidacja fiskalna, transfery i 800+, euro, obronność,
 * klimat i energia.
 */
export const tematy: Temat[] = [
  kwotaWolna,
  kwotaWolna12x,
  pitLiniowy,
  podatekBelki,
  dobrowolnyZus,
  uproszczenia,
  skladkaZdrowotna,
  konsolidacjaFiskalna,
  transfery800plus,
  euro,
  obronnosc,
  klimatEnergia,
];

export function znajdzTemat(slug: string): Temat | undefined {
  return tematy.find((temat) => temat.slug === slug);
}
