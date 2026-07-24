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

/**
 * Kolejność: kwota wolna (istniejący), potem sześć punktów programu
 * podatkowego Konfederacji z 2023 r. w kolejności z planu wyborczego.
 */
export const tematy: Temat[] = [
  kwotaWolna,
  kwotaWolna12x,
  pitLiniowy,
  podatekBelki,
  dobrowolnyZus,
  uproszczenia,
];

export function znajdzTemat(slug: string): Temat | undefined {
  return tematy.find((temat) => temat.slug === slug);
}
