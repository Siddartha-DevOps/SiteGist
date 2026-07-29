import { describe, it, expect } from "vitest";
import { normalizeDomain, originHost, isOriginAllowed } from "./domains";

describe("normalizeDomain", () => {
  it("strips scheme, path, port, and wildcard", () => {
    expect(normalizeDomain("https://example.com/widget")).toBe("example.com");
    expect(normalizeDomain("example.com:3000")).toBe("example.com");
    expect(normalizeDomain("*.example.com")).toBe("example.com");
    expect(normalizeDomain("  EXAMPLE.com ")).toBe("example.com");
  });
  it("rejects malformed entries", () => {
    expect(normalizeDomain("")).toBe("");
    expect(normalizeDomain("not a domain")).toBe("");
    expect(normalizeDomain("bare")).toBe(""); // no dot, not localhost
  });
});

describe("isOriginAllowed", () => {
  it("matches exact host and subdomains only", () => {
    expect(isOriginAllowed("https://example.com", ["example.com"])).toBe(true);
    expect(isOriginAllowed("https://app.example.com", ["example.com"])).toBe(true);
  });

  it("blocks the substring-bypass the old origin.includes() allowed", () => {
    // These would have passed a naive `origin.includes("example.com")` check.
    expect(isOriginAllowed("https://example.com.attacker.com", ["example.com"])).toBe(false);
    expect(isOriginAllowed("https://notexample.com", ["example.com"])).toBe(false);
    expect(isOriginAllowed("https://evilexample.com", ["example.com"])).toBe(false);
  });

  it("denies when the request has no/invalid origin", () => {
    expect(isOriginAllowed(null, ["example.com"])).toBe(false);
    expect(isOriginAllowed("garbage", ["example.com"])).toBe(false);
  });

  it("handles allowlist entries written with scheme/port/wildcard", () => {
    expect(isOriginAllowed("https://shop.example.com", ["*.example.com"])).toBe(true);
    expect(isOriginAllowed("https://example.com", ["https://example.com:443/"])).toBe(true);
  });
});

describe("originHost", () => {
  it("extracts the lowercased hostname", () => {
    expect(originHost("https://APP.Example.com/path")).toBe("app.example.com");
    expect(originHost(null)).toBe(null);
    expect(originHost("::::")).toBe(null);
  });
});
