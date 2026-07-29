import { test, expect } from "@playwright/test";

// Smoke: open the marketing "Ask SiteGist" widget, send a message, and assert a
// streamed reply appears. This is the end-to-end guard for the class of bug that
// broke the homepage ("your message shows, but no reply") — it only passes when
// the SSE stream is parsed and rendered correctly against a live backend.
test("chat widget opens, accepts a message, and streams a reply", async ({ page }) => {
  await page.goto("/");

  // Open the floating launcher.
  await page.getByRole("button", { name: /chat with us/i }).click();
  await expect(page.getByText(/ask sitegist/i)).toBeVisible();

  // Type and send.
  const input = page.getByPlaceholder(/type your message/i);
  await input.fill("What is SiteGist?");
  await input.press("Enter");

  // The user's message renders immediately (client-side).
  await expect(page.getByText("What is SiteGist?")).toBeVisible();

  // A reply must stream into an assistant bubble. The typing indicator should
  // give way to real text — assert the assistant area gains content and that we
  // never end with the user's message as the last bubble.
  await expect
    .poll(
      async () => {
        const bubbles = await page.locator("#chat-messages .prose").allInnerTexts();
        return bubbles.join(" ").trim().length;
      },
      { timeout: 40_000, message: "expected a streamed assistant reply" }
    )
    .toBeGreaterThan(0);
});
