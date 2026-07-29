/**
 * Pure config-decision helpers shared with env.server. Kept dependency-free so
 * they can be unit-tested without booting the env module.
 */

/**
 * Resolve whether reranking is enabled. Explicit RERANK_ENABLED is authoritative;
 * when unset we fall back to legacy key-presence inference so existing deploys
 * keep their current behavior.
 */
export function resolveRerankEnabled(flagRaw: string | undefined, hasProvider: boolean): boolean {
  if (flagRaw === undefined) return hasProvider;
  return /^(1|true|yes|on)$/i.test(flagRaw.trim());
}

/**
 * Classify a PORTKEY_MODEL value. A provider-namespaced model ("@org/model" or
 * one containing "/") sent to the DIRECT OpenAI client 400s every request — the
 * Jul-9 outage — so that combination is a hard error. A non-OpenAI-looking name
 * is a soft warning. Returns null when the model is fine (or Portkey routes it).
 */
export function portkeyModelProblem(
  model: string | undefined,
  hasPortkeyRouting: boolean
): "namespaced_no_routing" | "not_openai_like" | null {
  if (!model) return null;
  if (hasPortkeyRouting) return null; // Portkey accepts namespaced models
  const looksNamespaced = model.startsWith("@") || model.includes("/");
  if (looksNamespaced) return "namespaced_no_routing";
  const looksOpenAI = /^(gpt-|o1|o3|o4|chatgpt|text-)/i.test(model);
  if (!looksOpenAI) return "not_openai_like";
  return null;
}
