import { describe, it, expect } from "vitest";
import { parseSSEEvents } from "./sse";

describe("parseSSEEvents", () => {
  it("resets event type after each boundary so content frames aren't mis-typed (the widget no-reply bug)", () => {
    // Exactly what the chat API streams: an initial session event, then bare
    // data: content frames with no preceding `event:` line.
    const stream =
      `event: session\ndata: {"sessionId":"s1","chatMode":"ai-only"}\n\n` +
      `data: {"content":"Hello"}\n\n` +
      `data: {"content":" world"}\n\n`;

    const events = parseSSEEvents(stream);

    expect(events).toEqual([
      { event: "session", data: '{"sessionId":"s1","chatMode":"ai-only"}' },
      { event: "message", data: '{"content":"Hello"}' }, // NOT "session"
      { event: "message", data: '{"content":" world"}' },
    ]);
    // The regression guard: content frames must be "message", never leak "session".
    expect(events.filter((e) => e.event === "message")).toHaveLength(2);
  });

  it("keeps named events attached to their own data line", () => {
    const stream =
      `event: metadata\ndata: {"sources":[]}\n\n` +
      `event: suggestions\ndata: ["a","b"]\n\n`;
    expect(parseSSEEvents(stream)).toEqual([
      { event: "metadata", data: '{"sources":[]}' },
      { event: "suggestions", data: '["a","b"]' },
    ]);
  });

  it("handles a trailing event with no final blank line", () => {
    expect(parseSSEEvents(`data: {"content":"hi"}`)).toEqual([
      { event: "message", data: '{"content":"hi"}' },
    ]);
  });

  it("ignores comments/heartbeats and CRLF line endings", () => {
    const stream = `: keep-alive\r\nevent: session\r\ndata: {"sessionId":"x"}\r\n\r\n`;
    expect(parseSSEEvents(stream)).toEqual([{ event: "session", data: '{"sessionId":"x"}' }]);
  });

  it("returns nothing for empty input", () => {
    expect(parseSSEEvents("")).toEqual([]);
  });
});
