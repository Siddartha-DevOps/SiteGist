import { describe, expect, it } from "vitest";
import { validateQaFields } from "./qa-fields";

describe("validateQaFields", () => {
  it("requires both question and answer", () => {
    expect(validateQaFields("", "ans")).toMatch(/required/i);
    expect(validateQaFields("q", "")).toMatch(/required/i);
    expect(validateQaFields("  ", "  ")).toMatch(/required/i);
  });

  it("enforces length limits", () => {
    expect(validateQaFields("q".repeat(501), "a")).toMatch(/500/i);
    expect(validateQaFields("q", "a".repeat(5001))).toMatch(/5000/i);
  });

  it("accepts valid pairs", () => {
    expect(validateQaFields("What is your refund policy?", "We offer a 7-day refund.")).toBeNull();
  });
});
