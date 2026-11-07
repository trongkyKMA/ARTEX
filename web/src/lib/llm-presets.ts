// Provider presets for the "New model config" form (System -> LLM).
//
// A preset only pre-fills the request format + base URL and offers suggested model
// IDs to click instead of typing them. Everything stays editable, and the refresh
// button next to the model field still loads the exact, live model list from the
// provider (/models) - that list is authoritative; the suggestions below are a
// snapshot (Nov 2026) and providers rename/retire models regularly.
//
// Base URL rules (see agent/provider.go ConfigFrom): the backend appends
//   format "anthropic"        -> {base}/v1/messages
//   format "openai"           -> {base}/chat/completions
//   format "openai-responses" -> {base}/responses
// so each URL below is the API base for that format, without the endpoint path.

export type LLMFormat = "anthropic" | "openai" | "openai-responses";

export type LLMPreset = {
  id: string;
  label: string;
  /** Base URL per supported format. The first key is the preset's default format. */
  endpoints: Partial<Record<LLMFormat, string>>;
  /** Suggested model IDs, most capable / recommended first. */
  models: string[];
  /** Optional caveat shown under the preset selector. */
  note?: string;
};

export const CUSTOM_PRESET = "custom";

export const LLM_PRESETS: LLMPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    endpoints: {
      openai: "https://api.deepseek.com",
      anthropic: "https://api.deepseek.com/anthropic",
    },
    models: ["deepseek-v4-pro", "deepseek-v4-flash"],
    note: "The legacy names deepseek-chat / deepseek-reasoner were retired in July 2026; use the v4 names.",
  },
  {
    id: "zhipu",
    label: "Zhipu GLM (BigModel, China)",
    endpoints: {
      openai: "https://open.bigmodel.cn/api/paas/v4",
      anthropic: "https://open.bigmodel.cn/api/anthropic",
    },
    models: ["glm-5.3", "glm-5.2", "glm-5.1"],
    note: "Accounts on a GLM Coding Plan may only be able to use the OpenAI format. Coding Plan keys use a separate base URL (…/api/coding/paas/v4); enter it manually if needed.",
  },
  {
    id: "zai",
    label: "Z.ai GLM (international)",
    endpoints: {
      openai: "https://api.z.ai/api/paas/v4",
      anthropic: "https://api.z.ai/api/anthropic",
    },
    models: ["glm-5.3", "glm-5.2", "glm-5.1"],
    note: "Accounts on a GLM Coding Plan may only be able to use the OpenAI format.",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    endpoints: {
      anthropic: "https://api.anthropic.com",
    },
    models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-1"],
  },
  {
    id: "openai",
    label: "OpenAI",
    endpoints: {
      "openai-responses": "https://api.openai.com/v1",
      openai: "https://api.openai.com/v1",
    },
    models: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"],
  },
];

export function findPreset(id: string): LLMPreset | undefined {
  return LLM_PRESETS.find((p) => p.id === id);
}

/** Default format of a preset = its first endpoint key. */
export function presetDefaultFormat(p: LLMPreset): LLMFormat {
  return Object.keys(p.endpoints)[0] as LLMFormat;
}

function norm(u: string): string {
  return u.trim().replace(/\/+$/, "").toLowerCase();
}

/**
 * Detects which preset an existing config belongs to from its base URL (any of the
 * preset's endpoints). Empty base URL with the anthropic format maps to Anthropic,
 * which is the backend's default endpoint. Returns CUSTOM_PRESET when nothing matches.
 */
export function detectPreset(format: LLMFormat, baseUrl: string): string {
  const b = norm(baseUrl);
  if (!b) return format === "anthropic" ? "anthropic" : CUSTOM_PRESET;
  for (const p of LLM_PRESETS) {
    if (Object.values(p.endpoints).some((u) => u && norm(u) === b)) return p.id;
  }
  return CUSTOM_PRESET;
}

/** Light sanity check for a model ID; returns a warning string or "" when it looks fine. */
export function modelIdWarning(model: string): string {
  if (!model) return "";
  if (model !== model.trim()) return "The model ID has leading/trailing spaces (they are trimmed on save).";
  if (/\s/.test(model)) return "Model IDs normally contain no spaces.";
  if (/[^\x21-\x7e]/.test(model))
    return "The model ID contains non-ASCII characters (e.g. full-width punctuation); check the exact ID.";
  return "";
}
