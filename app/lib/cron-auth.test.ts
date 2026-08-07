import { describe, it, expect, beforeEach } from "vitest";
import { isCronAuthorized } from "./cron-auth.server";

describe("isCronAuthorized", () => {
  const secret = "test-cron-secret";

  beforeEach(() => {
    process.env.CRON_SECRET = secret;
  });

  it("accepts query token", () => {
    const req = new Request(`https://example.com/api/cron/test?token=${secret}`);
    expect(isCronAuthorized(req)).toBe(true);
  });

  it("accepts x-cron-secret header", () => {
    const req = new Request("https://example.com/api/cron/test", {
      headers: { "x-cron-secret": secret },
    });
    expect(isCronAuthorized(req)).toBe(true);
  });

  it("accepts Authorization Bearer (Vercel Crons)", () => {
    const req = new Request("https://example.com/api/cron/test", {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(isCronAuthorized(req)).toBe(true);
  });

  it("rejects missing or wrong token", () => {
    expect(isCronAuthorized(new Request("https://example.com/api/cron/test"))).toBe(false);
    expect(
      isCronAuthorized(
        new Request("https://example.com/api/cron/test", { headers: { authorization: "Bearer wrong" } })
      )
    ).toBe(false);
  });
});
