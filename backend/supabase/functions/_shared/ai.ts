// AI module for Edge Functions (Deno) based on LangChain.
// All AI calls happen EXCLUSIVELY in Edge Functions. The Anthropic API key
// is never exposed to the client (see CLAUDE.md).
import { ChatAnthropic } from "npm:@langchain/anthropic";

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

// Model for content generation (briefs, message variants, morning brief).
export function getGenerationModel(): ChatAnthropic {
  return new ChatAnthropic({
    model: GENERATION_MODEL,
    apiKey: getApiKey(),
  });
}

// Model for cheap classification tasks (topic tagging, routing).
export function getClassificationModel(): ChatAnthropic {
  return new ChatAnthropic({
    model: CLASSIFICATION_MODEL,
    apiKey: getApiKey(),
  });
}

// Prompt loader: reads _shared/prompts/<name>.md, cached per isolate.
const promptCache = new Map<string, string>();

export async function loadPrompt(name: string): Promise<string> {
  const cached = promptCache.get(name);
  if (cached !== undefined) return cached;

  const url = new URL(`./prompts/${name}.md`, import.meta.url);
  const text = await Deno.readTextFile(url);
  promptCache.set(name, text);
  return text;
}
