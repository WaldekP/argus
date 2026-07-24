/**
 * Wybór dokumentu do analizy niespójności (PDF, TXT, MD).
 * Wzorzec z docs/kontrakt-analizy.md: txt/md czytamy na kliencie i wysyłamy
 * jako `text`, pdf wysyłamy jako `content_base64` (limit 5 MB).
 *
 * Odczyt pliku:
 * - web: DocumentPicker zwraca uri blob, czytamy przez fetch (text/arrayBuffer),
 * - iOS/Android: nowe API expo-file-system (klasa File: .text() / .base64()).
 */

import * as DocumentPicker from 'expo-document-picker';
import { File as FsFile } from 'expo-file-system';
import { Platform } from 'react-native';

/** Limit rozmiaru pliku (kontrakt: 5 MB). */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

const SIZE_ERROR = 'Plik jest za duży. Limit to 5 MB.';
const TYPE_ERROR = 'Nieobsługiwany format pliku. Wybierz PDF, TXT albo MD.';
const READ_ERROR = 'Nie udało się odczytać pliku. Spróbuj ponownie.';

/** Dokument gotowy do wysłania przez add_document. */
export type PickedDocument = {
  filename: string;
  mime: string;
  /** Treść tekstowa dla txt/md. */
  text?: string;
  /** Zawartość base64 dla pdf. */
  contentBase64?: string;
  /** Rozmiar w bajtach, jeśli znany. */
  size: number | null;
};

type DocumentKind = 'pdf' | 'text';

/**
 * Klasyfikacja pliku po mime, a gdy mime bywa puste (częste na Androidzie
 * i webie), po rozszerzeniu nazwy.
 */
function classifyDocument(filename: string, mime: string): DocumentKind | null {
  const lowerMime = mime.toLowerCase();
  if (lowerMime === 'application/pdf') {
    return 'pdf';
  }
  if (lowerMime === 'text/plain' || lowerMime === 'text/markdown') {
    return 'text';
  }
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.pdf')) {
    return 'pdf';
  }
  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) {
    return 'text';
  }
  return null;
}

/** Domyślny mime, gdy picker go nie poda. */
function fallbackMime(kind: DocumentKind, filename: string): string {
  if (kind === 'pdf') {
    return 'application/pdf';
  }
  return filename.toLowerCase().endsWith('.txt') ? 'text/plain' : 'text/markdown';
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Kodowanie bajtów do base64 bez zależności od btoa/FileReader,
 * spójne na webie i natywnie.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += BASE64_ALPHABET[b0 >> 2];
    result += BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    result += i + 1 < bytes.length ? BASE64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < bytes.length ? BASE64_ALPHABET[b2 & 0x3f] : '=';
  }
  return result;
}

async function readTextContent(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return response.text();
  }
  return new FsFile(uri).text();
}

async function readBase64Content(uri: string): Promise<{ base64: string; bytes: number }> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_DOCUMENT_BYTES) {
      throw new Error(SIZE_ERROR);
    }
    return { base64: bytesToBase64(new Uint8Array(buffer)), bytes: buffer.byteLength };
  }
  const file = new FsFile(uri);
  const base64 = await file.base64();
  // Rozmiar z długości base64 (4 znaki na 3 bajty), wystarczające do limitu.
  return { base64, bytes: Math.floor((base64.length * 3) / 4) };
}

/**
 * Otwiera systemowy picker i zwraca dokument gotowy do add_document.
 * Zwraca null, gdy user anuluje wybór. Rzuca Error z polskim komunikatem
 * przy nieobsługiwanym formacie, przekroczonym limicie albo błędzie odczytu.
 */
export async function pickAnalysisDocument(): Promise<PickedDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'text/plain', 'text/markdown'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const filename = asset.name || 'dokument';
  const kind = classifyDocument(filename, asset.mimeType ?? '');
  if (!kind) {
    throw new Error(TYPE_ERROR);
  }
  if (typeof asset.size === 'number' && asset.size > MAX_DOCUMENT_BYTES) {
    throw new Error(SIZE_ERROR);
  }

  const mime = asset.mimeType || fallbackMime(kind, filename);

  try {
    if (kind === 'text') {
      const text = await readTextContent(asset.uri);
      if (text.length > MAX_DOCUMENT_BYTES) {
        throw new Error(SIZE_ERROR);
      }
      return {
        filename,
        mime,
        text,
        size: typeof asset.size === 'number' ? asset.size : text.length,
      };
    }

    const { base64, bytes } = await readBase64Content(asset.uri);
    if (bytes > MAX_DOCUMENT_BYTES) {
      throw new Error(SIZE_ERROR);
    }
    return {
      filename,
      mime,
      contentBase64: base64,
      size: typeof asset.size === 'number' ? asset.size : bytes,
    };
  } catch (error) {
    if (error instanceof Error && (error.message === SIZE_ERROR || error.message === TYPE_ERROR)) {
      throw error;
    }
    throw new Error(READ_ERROR);
  }
}

/** Rozmiar pliku jako tekst dla UI: bajty, kB albo MB. */
export function formatDocumentSize(size: number | null): string {
  if (size === null || size <= 0) {
    return '';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} kB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
