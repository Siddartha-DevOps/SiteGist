import { describe, it, expect } from "vitest";
import { resolveRerankEnabled, portkeyModelProblem } from "./env-rules";

describe("resolveRerankEnabled", () => {
  it("is authoritative when the flag is set", () => {
    expect(resolveRerankEnabled("true", false)).toBe(true);
    expect(resolveRerankEnabled("1", false)).toBe(true);
    expect(resolveRerankEnabled("on", true)).toBe(true);
    expect(resolveRerankEnabled("false", true)).toBe(false);
    expect(resolveRerankEnabled("no", true)).toBe(false);
  });
  it("falls back to key-presence inference when unset (back-compat)", () => {
    expect(resolveRerankEnabled(undefined, true)).toBe(true);
    expect(resolveRerankEnabled(undefined, false)).toBe(false);
  });
});

describe("portkeyModelProblem", () => {
  it("hard-errors on a namespaced model with no Portkey routing (the Jul-9 outage)", () => {
    expect(portkeyModelProblem("@my-org/c4ai-aya", false)).toBe("namespaced_no_routing");
    expect(portkeyModelProblem("vendor/model-x", false)).toBe("namespaced_no_routing");
  });
  it("allows namespaced models when Portkey routes them", () => {
    expect(portkeyModelProblem("@my-org/c4ai-aya", true)).toBe(null);
  });
  it("accepts OpenAI-looking models on the direct client", () => {
    expect(portkeyModelProblem("gpt-4o-mini", false)).toBe(null);
    expect(portkeyModelProblem("o3-mini", false)).toBe(null);
  });
  it("soft-warns on a non-OpenAI-looking name", () => {
    expect(portkeyModelProblem("llama-3.1-8b", false)).toBe("not_openai_like");
  });
  it("is a no-op when unset", () => {
    expect(portkeyModelProblem(undefined, false)).toBe(null);
    expect(portkeyModelProblem("", false)).toBe(null);
  });
});
