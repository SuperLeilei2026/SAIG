import type { Reply } from "./types";

const KEY_STORAGE = "saig_llm_key";
const URL_STORAGE = "saig_llm_url";
const MODEL_STORAGE = "saig_llm_model";

export interface LlmConfig {
  url: string;
  key: string;
  model: string;
}

export function readLlmConfig(): LlmConfig {
  try {
    return {
      url: localStorage.getItem(URL_STORAGE)?.trim() ?? "",
      key: localStorage.getItem(KEY_STORAGE)?.trim() ?? "",
      model: localStorage.getItem(MODEL_STORAGE)?.trim() || "gpt-4o-mini"
    };
  } catch {
    return { url: "", key: "", model: "gpt-4o-mini" };
  }
}

export function writeLlmConfig(config: LlmConfig): void {
  localStorage.setItem(URL_STORAGE, config.url.trim());
  localStorage.setItem(KEY_STORAGE, config.key.trim());
  localStorage.setItem(MODEL_STORAGE, config.model.trim() || "gpt-4o-mini");
}

export function clearLlmConfig(): void {
  localStorage.removeItem(URL_STORAGE);
  localStorage.removeItem(KEY_STORAGE);
  localStorage.removeItem(MODEL_STORAGE);
}

export function llmConfigured(): boolean {
  const config = readLlmConfig();
  return Boolean(config.url && config.key);
}

/**
 * Optional polish. The model may only rephrase the grounded reply.
 * Any failure returns null so the UI keeps the offline answer.
 */
export async function tryRephrase(question: string, reply: Reply, grounded: string): Promise<string | null> {
  const config = readLlmConfig();
  if (!config.url || !config.key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.key}`
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "你是武汉城市接待员的语气编辑。只能重写用户给出的「已核对正文」，让它更口语。禁止添加正文里没有的数字、地名、时间、票价和承诺。若无从改写，原样返回正文。"
          },
          {
            role: "user",
            content: `问题：${question}\n\n已核对正文：\n${grounded}`
          }
        ]
      })
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content || content.length > grounded.length * 1.6) return null;
    return content;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
