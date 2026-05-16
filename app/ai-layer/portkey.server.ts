import { Portkey } from "portkey-ai";

/**
 * Portkey is used for AI observability, routing, and caching.
 * It wraps OpenAI calls to provide a dashboard with logs and traces.
 */
let _portkey: Portkey | null = null;

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
    apiKey = apiKey.replace(/[\s\u00A0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff\x00-\x1f\x7f-\x9f]/g, "");
    if ((apiKey.startsWith('"') && apiKey.endsWith('"')) || (apiKey.startsWith("'") && apiKey.endsWith("'"))) {
      apiKey = apiKey.substring(1, apiKey.length - 1).trim();
      apiKey = apiKey.replace(/[\s\u00A0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff\x00-\x1f\x7f-\x9f]/g, "");
    }

    // Clean Virtual Key
    let virtualKey = rawVirtualKey?.trim();
    if (virtualKey) {
      if (virtualKey.includes("=")) {
        const match = virtualKey.match(/^[A-Z0-9_]+=(.*)$/s);
        if (match) virtualKey = match[1].trim();
      }
      virtualKey = virtualKey.replace(/[\s\u00A0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff\x00-\x1f\x7f-\x9f]/g, "");
      if ((virtualKey.startsWith('"') && virtualKey.endsWith('"')) || (virtualKey.startsWith("'") && virtualKey.endsWith("'"))) {
        virtualKey = virtualKey.substring(1, virtualKey.length - 1).trim();
        virtualKey = virtualKey.replace(/[\s\u00A0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff\x00-\x1f\x7f-\x9f]/g, "");
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

    console.log(`[Portkey] Using Portkey with API Key starting: ${apiKey.substring(0, 7)}... and Virtual Key: ${virtualKey ? virtualKey.substring(0, 7) + "..." : "NONE"}`);

    _portkey = new Portkey({
      apiKey,
      virtualKey,
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
