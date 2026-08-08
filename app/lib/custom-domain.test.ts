import { describe, expect, it } from "vitest";
import { normalizeDomain } from "./domains";

// Pure pieces of custom-domain flow that don't need DNS/network/prisma.
describe("custom domain input normalization", () => {
  it("strips scheme, path, port, and wildcard", () => {
    expect(normalizeDomain("https://Chat.Example.com:443/path")).toBe("chat.example.com");
    expect(normalizeDomain("*.chat.example.com")).toBe("chat.example.com");
  });

  it("rejects junk", () => {
    expect(normalizeDomain("")).toBe("");
    expect(normalizeDomain("not a host")).toBe("");
  });
});
