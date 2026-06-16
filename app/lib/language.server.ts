/**
 * Lightweight, dependency-free language detection + a response-language directive
 * for the RAG prompt. The underlying LLMs (Gemini / GPT) already understand ~100
 * languages — the missing piece was *instructing* them to answer in the user's
 * language and giving them an explicit hint. This makes the "95+ languages" claim
 * real without a heavy NLP dependency.
 *
 * Detection is two-tier:
 *   1. Unicode script ranges for non-Latin scripts (deterministic, exact).
 *   2. A small stop-word heuristic for the most common Latin-script languages.
 * When neither is confident we return "auto" and let the model mirror the query.
 */

export interface DetectedLanguage {
  code: string; // ISO-639-1-ish, or "auto"
  name: string; // human-readable, used directly in the prompt
}

const SCRIPT_RANGES: { code: string; name: string; re: RegExp }[] = [
  { code: "ja", name: "Japanese", re: /[぀-ゟ゠-ヿ]/ }, // kana first (before Han)
  { code: "ko", name: "Korean", re: /[가-힯ᄀ-ᇿ]/ },
  { code: "zh", name: "Chinese", re: /[一-鿿㐀-䶿]/ },
  { code: "ar", name: "Arabic", re: /[؀-ۿݐ-ݿ]/ },
  { code: "he", name: "Hebrew", re: /[֐-׿]/ },
  { code: "ru", name: "Russian", re: /[Ѐ-ӿ]/ },
  { code: "el", name: "Greek", re: /[Ͱ-Ͽ]/ },
  { code: "hi", name: "Hindi", re: /[ऀ-ॿ]/ },
  { code: "bn", name: "Bengali", re: /[ঀ-৿]/ },
  { code: "ta", name: "Tamil", re: /[஀-௿]/ },
  { code: "te", name: "Telugu", re: /[ఀ-౿]/ },
  { code: "th", name: "Thai", re: /[฀-๿]/ },
];

// Small, high-signal stop-word sets for common Latin-script languages.
const LATIN_STOPWORDS: { code: string; name: string; words: string[] }[] = [
  { code: "es", name: "Spanish", words: ["el", "la", "los", "que", "de", "por", "cómo", "qué", "para", "una", "está", "gracias"] },
  { code: "fr", name: "French", words: ["le", "la", "les", "des", "que", "vous", "pour", "comment", "est", "une", "bonjour", "merci"] },
  { code: "de", name: "German", words: ["der", "die", "das", "und", "wie", "ist", "für", "nicht", "ich", "eine", "danke", "haben"] },
  { code: "pt", name: "Portuguese", words: ["o", "que", "de", "para", "como", "uma", "você", "obrigado", "está", "não", "com", "isso"] },
  { code: "it", name: "Italian", words: ["il", "che", "di", "per", "come", "una", "sono", "non", "grazie", "questo", "ciao", "anche"] },
  { code: "nl", name: "Dutch", words: ["de", "het", "een", "en", "hoe", "is", "voor", "niet", "ik", "dank", "kan", "wat"] },
];

export function detectLanguage(text: string): DetectedLanguage {
  const t = (text || "").trim();
  if (!t) return { code: "auto", name: "the user's language" };

  for (const s of SCRIPT_RANGES) {
    if (s.re.test(t)) return { code: s.code, name: s.name };
  }

  // Latin-script heuristic: count stop-word hits, require a clear winner.
  const tokens = new Set(
    t.toLowerCase().replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean)
  );
  let best: { code: string; name: string; hits: number } | null = null;
  for (const lang of LATIN_STOPWORDS) {
    let hits = 0;
    for (const w of lang.words) if (tokens.has(w)) hits++;
    if (hits >= 2 && (!best || hits > best.hits)) best = { code: lang.code, name: lang.name, hits };
  }
  if (best) return { code: best.code, name: best.name };

  return { code: "auto", name: "the user's language" };
}

// Map a forced setting (code or free-text name) to a readable language name.
const CODE_TO_NAME: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese",
  it: "Italian", nl: "Dutch", ru: "Russian", ja: "Japanese", ko: "Korean",
  zh: "Chinese", ar: "Arabic", he: "Hebrew", hi: "Hindi", bn: "Bengali",
  ta: "Tamil", te: "Telugu", th: "Thai", el: "Greek",
};

/**
 * Build the language instruction injected into the generation prompt.
 * `forced` (project setting `settings.language`) wins when set to a real language;
 * "auto"/empty falls back to detecting the query language and mirroring it.
 */
export function languageDirective(query: string, forced?: string): string {
  const f = (forced || "").trim().toLowerCase();
  if (f && f !== "auto") {
    const name = CODE_TO_NAME[f] || (forced as string).trim();
    return `Always respond in ${name}, regardless of the language of the question or the knowledge context. If the knowledge context is in another language, translate your answer into ${name}.`;
  }

  const d = detectLanguage(query);
  if (d.code !== "auto") {
    return `The user's message is written in ${d.name}. Respond in ${d.name}. If the knowledge context is in a different language, translate your answer into ${d.name}. Never switch languages mid-answer.`;
  }
  return `Respond in the SAME language as the user's most recent message. If the knowledge context is in a different language, translate your answer into the user's language. Never switch languages mid-answer.`;
}
