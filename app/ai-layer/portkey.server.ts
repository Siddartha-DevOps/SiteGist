import { Portkey } from "portkey-ai";

/**
 * Portkey is used for AI observability, routing, and caching.
 * It wraps OpenAI calls to provide a dashboard with logs and traces.
 */
let _portkey: Portkey | null = null;

export function getPortkey() {
  if (!_portkey) {
    const apiKey = process.env.PORTKEY_API_KEY?.trim();
    const virtualKey = process.env.PORTKEY_VIRTUAL_KEY?.trim();
    
    if (!apiKey) {
      console.warn("PORTKEY_API_KEY is not defined. Falling back to standard OpenAI calls if available.");
      return null;
    }

    if (!apiKey.startsWith("pk-")) {
      console.warn(`[Portkey] PORTKEY_API_KEY does not start with "pk-". It might be a virtual key by mistake.apiKey Masked: ${apiKey.substring(0, 4)}...${apiKey.slice(-4)}`);
    }

    _portkey = new Portkey({
      apiKey,
      virtualKey, // This maps to your OpenAI/Gemini/etc. credentials in Portkey
    });
  }
  return _portkey;
}

/**
 * Example usage:
 * const portkey = getPortkey();
 * const chatCompletion = await portkey.chat.completions.create({
 *   messages: [{ role: 'user', content: 'Say this is a test' }],
 *   model: 'gpt-4',
 * });
 */
