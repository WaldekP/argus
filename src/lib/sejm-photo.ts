/**
 * Zdjęcia posłów z otwartego API Sejmu (https://api.sejm.gov.pl).
 *
 * URL jest w pełni wyliczalny z `mp_id`, API nie wymaga klucza i odbija
 * nagłówek `Access-Control-Allow-Origin`, więc obraz ładuje się wprost do
 * komponentu Image, także na webie. Nie zwraca `ETag` ani `Last-Modified`,
 * więc jedynym kluczem cache jest identyfikator posła.
 */

/** Kadencja Sejmu, z której bierzemy dane i zdjęcia. */
export const SEJM_TERM = 10;

const SEJM_API = `https://api.sejm.gov.pl/sejm/term${SEJM_TERM}`;

/** Wariant zdjęcia: miniatura na listy, pełne na karty. */
export type MpPhotoSize = 'mini' | 'full';

/** Adres zdjęcia posła. Miniatura waży ok. 2 KB, pełne od 4 do 16 KB. */
export function mpPhotoUrl(mpId: number, size: MpPhotoSize = 'full'): string {
  return `${SEJM_API}/MP/${mpId}/${size === 'mini' ? 'photo-mini' : 'photo'}`;
}

/**
 * Inicjały do awatara zastępczego, gdy zdjęcia nie da się pobrać.
 * Bierzemy pierwsze litery dwóch pierwszych członów nazwy.
 */
export function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('pl-PL'))
    .join('');
}
