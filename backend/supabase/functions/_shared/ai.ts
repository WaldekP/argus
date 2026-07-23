// AI module for Edge Functions (Deno) based on LangChain.
// All AI calls happen EXCLUSIVELY in Edge Functions. The Anthropic API key
// is never exposed to the client (see CLAUDE.md).
//
// LangChain is loaded LAZILY (dynamic import): operations that don't call
// the LLM (e.g. Sejm import steps, embeddings) must not pay its memory cost.
// Edge Function workers have tight resource limits (WORKER_RESOURCE_LIMIT).
import type { ChatAnthropic } from "npm:@langchain/anthropic";

// Models per CLAUDE.md: sonnet 5 for generation (briefs, content),
// haiku 4.5 for classification.
const GENERATION_MODEL = "claude-sonnet-5";
const CLASSIFICATION_MODEL = "claude-haiku-4-5";

function getApiKey(): string {
  const key = Deno.env.get("ANTHROPIC_API_KEY") ?? Deno.env.get("CLAUDE_API_KEY");
  if (!key) {
    throw new Error(
      "Missing Anthropic API key: set ANTHROPIC_API_KEY (or CLAUDE_API_KEY) via `supabase secrets set`",
    );
  }
  return key;
}

async function loadChatAnthropic() {
  const mod = await import("npm:@langchain/anthropic");
  return mod.ChatAnthropic;
}

// Model for content generation (briefs, message variants, morning brief).
export async function getGenerationModel(): Promise<ChatAnthropic> {
  const Chat = await loadChatAnthropic();
  return new Chat({
    model: GENERATION_MODEL,
    apiKey: getApiKey(),
  });
}

// Model for cheap classification tasks (topic tagging, routing).
export async function getClassificationModel(): Promise<ChatAnthropic> {
  const Chat = await loadChatAnthropic();
  return new Chat({
    model: CLASSIFICATION_MODEL,
    apiKey: getApiKey(),
  });
}

// Prompt loader. Deploy nie bundluje plikow .md, wiec prompty sa modulem TS
// generowanym z .md przez backend/scripts/build-prompts.sh (patrz prompts/README.md).
import { prompts } from "./prompts/index.ts";

export function loadPrompt(name: string): string {
  const text = prompts[name];
  if (text === undefined) {
    throw new Error(
      `Nieznany prompt "${name}" — dostepne: ${Object.keys(prompts).join(", ")}. ` +
        "Po dodaniu pliku .md odpal backend/scripts/build-prompts.sh",
    );
  }
  return text;
}
