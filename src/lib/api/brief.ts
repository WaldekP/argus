/**
 * Klient Edge Function `argus-brief`: brief przedwywiadowy.
 *
 * Wejście to „gdzie, kto, temat", wyjście to materiał do przeczytania przed
 * wejściem do studia: profil rozmówcy, publiczność, dziesięć przewidywanych
 * pytań z prawdopodobieństwem i rekomendowaną odpowiedzią, pułapki z mostami
 * oraz trzy przekazy dnia.
 */

import { edgeClient, LONG_TIMEOUT_MS } from '@/lib/api/client';

/** Rekomendacja do jednego pytania. Trzyma się kształtu z `recommended_answer`. */
export type RecommendedAnswer = {
  teza: string;
  punkty: string[];
  ryzyko: string;
};

export type BriefQuestion = {
  id: string;
  question: string;
  /** 0-1, ocena modelu, nie wynik pomiaru. */
  probability: number | null;
  recommended_answer: RecommendedAnswer;
  /** Feedback po wywiadzie: czy pytanie padło. Null, dopóki nikt nie ocenił. */
  was_asked: boolean | null;
};

export type BriefContent = {
  profil_rozmowcy: string;
  publicznosc: string;
  pulapki: { pulapka: string; most: string }[];
  przekazy_dnia: string[];
};

export type BriefStatus = 'generating' | 'ready' | 'error';

type JournalistRef = {
  full_name: string;
  role?: string | null;
  outlets: { name: string } | null;
} | null;

export type InterviewBrief = {
  id: string;
  topic: string;
  status: BriefStatus;
  content: BriefContent;
  rating: number | null;
  feedback: string | null;
  scheduled_at: string | null;
  created_at: string;
  journalist_id: string | null;
  journalists: JournalistRef;
};

export type BriefListItem = {
  id: string;
  topic: string;
  status: BriefStatus;
  rating: number | null;
  scheduled_at: string | null;
  created_at: string;
  journalists: JournalistRef;
};

type BriefOperation = 'create' | 'get' | 'list' | 'rate' | 'question_feedback';

const callBrief = edgeClient<BriefOperation>('argus-brief');

/**
 * Zamawia brief. Generacja to jedno wywołanie modelu na pełnym kontekście,
 * więc trwa około półtorej minuty. Stąd dłuższy limit czasu.
 */
export function createBrief(params: {
  topic: string;
  journalist_id?: string;
  journalist_name?: string;
  scheduled_at?: string;
}) {
  return callBrief<{ brief: InterviewBrief; questions: BriefQuestion[] }>(
    'create',
    params,
    LONG_TIMEOUT_MS
  );
}

export function getBrief(briefId: string) {
  return callBrief<{ brief: InterviewBrief; questions: BriefQuestion[] }>('get', {
    brief_id: briefId,
  });
}

export async function listBriefs(): Promise<BriefListItem[]> {
  const data = await callBrief<{ briefs: BriefListItem[] }>('list');
  return data.briefs;
}

/** Ocena briefu po wywiadzie, 1-5. Wprost z definicji ukończenia MVP. */
export function rateBrief(briefId: string, rating: number, feedback?: string) {
  return callBrief<{ rated: true }>('rate', {
    brief_id: briefId,
    rating,
    ...(feedback ? { feedback } : {}),
  });
}

/** Czy pytanie faktycznie padło. To ono, a nie cały brief, jest jednostką oceny. */
export function markQuestionAsked(questionId: string, wasAsked: boolean) {
  return callBrief<{ saved: true }>('question_feedback', {
    question_id: questionId,
    was_asked: wasAsked,
  });
}
