import type { AppConfig } from "../../config";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConciergeModel {
  provider: "openai" | "anthropic";
  model: string;
  /** Returns the raw text completion (expected to be a JSON object). */
  complete(input: { system: string; messages: ChatMessage[] }): Promise<string>;
}

export class OpenAIConciergeModel implements ConciergeModel {
  readonly provider = "openai" as const;
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async complete({ system, messages }: { system: string; messages: ChatMessage[] }): Promise<string> {
    const res = await this.fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, ...messages],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty completion");
    return content;
  }
}

export class AnthropicConciergeModel implements ConciergeModel {
  readonly provider = "anthropic" as const;
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async complete({ system, messages }: { system: string; messages: ChatMessage[] }): Promise<string> {
    const res = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: this.model, max_tokens: 1024, temperature: 0.4, system, messages }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.find((b) => b.type === "text")?.text;
    if (!text) throw new Error("Anthropic returned an empty completion");
    return text;
  }
}

export function createConciergeModel(config: AppConfig): ConciergeModel | null {
  const provider =
    config.AI_PROVIDER ?? (config.OPENAI_API_KEY ? "openai" : config.ANTHROPIC_API_KEY ? "anthropic" : "none");
  if (provider === "openai" && config.OPENAI_API_KEY) {
    return new OpenAIConciergeModel(config.OPENAI_API_KEY, config.OPENAI_MODEL);
  }
  if (provider === "anthropic" && config.ANTHROPIC_API_KEY) {
    return new AnthropicConciergeModel(config.ANTHROPIC_API_KEY, config.ANTHROPIC_MODEL);
  }
  return null;
}
