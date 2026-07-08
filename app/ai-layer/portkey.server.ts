import { Portkey } from "portkey-ai";

/**
 * Portkey is used for AI observability, routing, and caching.
 * It wraps OpenAI calls to provide a dashboard with logs and traces.
 */
let _portkey: Portkey | null = null;

const STRIP_WHITESPACE = /[\s\u00A0\u1680\u180E\u2000-\u200A\u202F\u205F\u3000\uFEFF\x00-\x1f\x7f-\x9f]/g;

export function getPortkey() {
  if (!_portkey) {
    let rawApiKey = process.env.PORTKEY_API_KEY;
    let rawVirtualKey = process.env.PORTKEY_VIRTUAL_KEY;

    if (!rawApiKey) {
      console.warn("PORTKEY_API_KEY is not defined. Falling back to standard AI calls.");
      return null;
    }

    // Clean API Key
    let apiKey = rawApiKey.trim();
    if (apiKey.includes("=")) {
      const match = apiKey.match(/^[A-Z0-9_]+=(.*)$/s);
      if (match) apiKey = match[1].trim();
    }
    apiKey = apiKey.replace(STRIP_WHITESPACE, "");
    if ((apiKey.startsWith('"') && apiKey.endsWith('"')) || (apiKey.startsWith("'") && apiKey.endsWith("'"))) {
      apiKey = apiKey.substring(1, apiKey.length - 1).trim();
      apiKey = apiKey.replace(STRIP_WHITESPACE, "");
    }

    // Clean Virtual Key
    let virtualKey = rawVirtualKey?.trim();
    if (virtualKey) {
      if (virtualKey.includes("=")) {
        const match = virtualKey.match(/^[A-Z0-9_]+=(.*)$/s);
        if (match) virtualKey = match[1].trim();
      }
      virtualKey = virtualKey.replace(STRIP_WHITESPACE, "");
      if ((virtualKey.startsWith('"') && virtualKey.endsWith('"')) || (virtualKey.startsWith("'") && virtualKey.endsWith("'"))) {
        virtualKey = virtualKey.substring(1, virtualKey.length - 1).trim();
        virtualKey = virtualKey.replace(STRIP_WHITESPACE, "");
      }
    }

    if (!apiKey || apiKey === "your_portkey_api_key" || !apiKey.startsWith("pk-")) {
      if (apiKey && !apiKey.startsWith("pk-") && apiKey.length > 0) {
        console.warn(`[Portkey] PORTKEY_API_KEY does not start with "pk-". It might be an OpenAI key by mistake. Ignoring Portkey. Found: ${apiKey.substring(0, 7)}...`);
      } else {
        console.warn("PORTKEY_API_KEY is not defined or is placeholder. Falling back to standard AI calls.");
      }
      return null;
    }

    // Key-prefix diagnostics are for local debugging only — keep them out of production logs.
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Portkey] Using Portkey with API Key starting: ${apiKey.substring(0, 7)}... and Virtual Key: ${virtualKey ? virtualKey.substring(0, 7) + "..." : "NONE"}`);
    }

    _portkey = new Portkey({
      apiKey,
      virtualKey,
    });
  }
  return _portkey;
}

/** Strip env-var prefixes, wrapping quotes, and stray whitespace/control chars from a key. */
function cleanPortkeyValue(raw?: string): string {
  if (!raw) return "";
  let s = raw.trim();
  const m = s.match(/^[A-Z0-9_]+=(.*)$/s);
  if (m) s = m[1].trim();
  s = s.replace(STRIP_WHITESPACE, "");
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.substring(1, s.length - 1).trim();
    s = s.replace(STRIP_WHITESPACE, "");
  }
  return s;
}

let _portkeyEmbeddings: Portkey | null = null;

/**
 * Dedicated Portkey client for EMBEDDINGS, routed via PORTKEY_EMBEDDINGS_VIRTUAL_KEY.
 * Kept separate from getPortkey() (the chat client) so embedding requests are never
 * sent through the chat virtual key / chat provider. Returns null unless both
 * PORTKEY_API_KEY (pk-...) and PORTKEY_EMBEDDINGS_VIRTUAL_KEY are configured, so
 * embeddings fall back to a direct provider client rather than the chat route.
 */
export function getPortkeyEmbeddings() {
  if (_portkeyEmbeddings) return _portkeyEmbeddings;

  const apiKey = cleanPortkeyValue(process.env.PORTKEY_API_KEY);
  const virtualKey = cleanPortkeyValue(process.env.PORTKEY_EMBEDDINGS_VIRTUAL_KEY);
  if (!apiKey.startsWith("pk-") || !virtualKey) return null;

  _portkeyEmbeddings = new Portkey({ apiKey, virtualKey });
  return _portkeyEmbeddings;
}

/**
 * Example usage:
 * const portkey = getPortkey();
 * const chatCompletion = await portkey.chat.completions.create({
 *   messages: [{ role: 'user', content: 'Say this is a test' }],
 *   model: 'gpt-4',
 * });
 */
