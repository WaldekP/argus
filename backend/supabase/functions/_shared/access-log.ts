import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Ślad dostępu do danych tenanta (RODO, `access_logs`).
 *
 * Ta funkcja stała w sześciu kopiach, bajt w bajt, w osobnych funkcjach
 * brzegowych. Problem nie był w powielonych dziesięciu linijkach, tylko w tym,
 * że decyzja poniżej nie miała jednego miejsca, w którym da się ją zmienić.
 *
 * Decyzja: błąd zapisu jest POŁYKANY. Audyt nie może wywrócić operacji, po
 * której zostaje śladem, bo użytkownik straciłby wygenerowany brief przez
 * chwilowy problem z tabelą poboczną. Konsekwencja jest taka, że dziura
 * w logach nie da o sobie znać sama z siebie, więc nie traktujemy `access_logs`
 * jako źródła kompletnego.
 */
export async function logAccess(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  action: string,
  resource: string | null,
): Promise<void> {
  const { error } = await supabase.from("access_logs").insert({
    tenant_id: tenantId,
    user_id: userId,
    action,
    resource,
  });
  if (error) console.error("access_logs: zapis sie nie powiodl", error.message);
}
