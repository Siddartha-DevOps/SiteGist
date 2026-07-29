import { describe, it, expect } from "vitest";
import { mergeProjectSettings } from "./settings-merge";

describe("mergeProjectSettings", () => {
  it("preserves unmanaged keys the form doesn't submit (the settings-wipe bug)", () => {
    const existing = {
      systemPrompt: "old",
      notifications: { emailOnLead: true }, // not managed by the Bot Settings form
      strictDomains: true,
    };
    const incoming = { systemPrompt: "new", model: "gpt-4o-mini" };

    const merged = mergeProjectSettings(existing, incoming);

    expect(merged.notifications).toEqual({ emailOnLead: true }); // survived
    expect(merged.strictDomains).toBe(true); // survived
    expect(merged.systemPrompt).toBe("new"); // overwritten
    expect(merged.model).toBe("gpt-4o-mini"); // added
  });

  it("merges branding rather than replacing it", () => {
    const existing = { branding: { primaryColor: "#000", customField: "keep" } };
    const incoming = { branding: { primaryColor: "#fff", assistantName: "Ada" } };

    const merged = mergeProjectSettings(existing, incoming);

    expect(merged.branding).toEqual({
      primaryColor: "#fff", // overwritten
      customField: "keep", // preserved
      assistantName: "Ada", // added
    });
  });

  it("handles null/empty existing settings", () => {
    expect(mergeProjectSettings(null, { model: "x", branding: { a: 1 } })).toEqual({
      model: "x",
      branding: { a: 1 },
    });
    expect(mergeProjectSettings(undefined, { model: "x" }).branding).toEqual({});
  });
});
