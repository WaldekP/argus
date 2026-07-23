// LangGraph skeleton for the pre-interview brief pipeline (TASK 5).
// Flow: retrieve -> generate -> verify -> persist (see brief section 4).
// Nodes are stubs; the real implementation lands in TASK 5.
import { Annotation, END, START, StateGraph } from "npm:@langchain/langgraph";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Input from the "new brief" form.
export interface BriefInput {
  tenantId: string;
  outletId: string;
  journalistId: string;
  scheduledAt: string;
  topic: string;
}

// Context gathered in the retrieve step (vector + relational lookups).
export interface RetrievedContext {
  journalistProfile?: unknown;
  journalistMaterials?: unknown[];
  outletProfile?: unknown;
  newsItems?: unknown[];
  politicianProfile?: unknown;
  statements?: unknown[];
  votes?: unknown[];
  promises?: unknown[];
  previousBriefs?: unknown[];
}

const BriefState = Annotation.Root({
  input: Annotation<BriefInput>(),
  supabase: Annotation<SupabaseClient>(),
  retrieved: Annotation<RetrievedContext>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  // Generated brief sections (interlocutor profile, audience, 10 questions
  // with probabilities, answers, traps and bridges, 3 messages of the day).
  sections: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  // Red flags from the consistency check on recommended answers.
  consistencyFlags: Annotation<unknown[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  briefId: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

type BriefStateType = typeof BriefState.State;

// 1. Retrieve: journalist profile + recent materials (7d) + outlet profile
// + news_items on topic + politician profile + statements/votes/promises
// (vector search) + previous briefs with this journalist.
async function retrieve(_state: BriefStateType): Promise<Partial<BriefStateType>> {
  // TODO(TASK 5): implement retrieval (pgvector + relational queries)
  return { retrieved: {} };
}

// 2. Generate: brief sections via the generation model (loadPrompt + getGenerationModel).
async function generate(_state: BriefStateType): Promise<Partial<BriefStateType>> {
  // TODO(TASK 5): implement generation with style_profile injection
  return { sections: {} };
}

// 3. Verify: run argus-consistency on recommended answers -> red flags.
async function verify(_state: BriefStateType): Promise<Partial<BriefStateType>> {
  // TODO(TASK 5/6): implement consistency check
  return { consistencyFlags: [] };
}

// 4. Persist: save brief + questions, send push notification "Brief gotowy".
async function persist(_state: BriefStateType): Promise<Partial<BriefStateType>> {
  // TODO(TASK 5): implement persistence + push
  return { briefId: null };
}

// Compiled graph: retrieve -> generate -> verify -> persist.
export function buildBriefGraph() {
  return new StateGraph(BriefState)
    .addNode("retrieve", retrieve)
    .addNode("generate", generate)
    .addNode("verify", verify)
    .addNode("persist", persist)
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "generate")
    .addEdge("generate", "verify")
    .addEdge("verify", "persist")
    .addEdge("persist", END)
    .compile();
}
