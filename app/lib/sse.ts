export interface SSEEvent {
  event: string;
  data: string;
}

/**
 * Parse a complete Server-Sent-Events text block into discrete events.
 *
 * Crucially, the event type resets to the default ("message") at every event
 * boundary (a blank line). This is the exact contract the marketing chat widget
 * violated: it tracked `currentEvent` but never reset it, so after the server's
 * initial `event: session` frame, every subsequent bare `data:` content frame
 * was still treated as "session" and dropped — the "widget shows my message but
 * no reply" bug. Any SSE consumer should route content through this parser (or
 * mirror its reset behavior).
 */
export function parseSSEEvents(text: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  let event = "message";
  let dataLines: string[] = [];

  const flush = () => {
    if (dataLines.length > 0) {
      events.push({ event, data: dataLines.join("\n") });
    }
    event = "message"; // reset per SSE spec at the event boundary
    dataLines = [];
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line === "") {
      flush();
      continue;
    }
    if (line.startsWith(":")) continue; // comment/heartbeat
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).replace(/^ /, ""));
    }
  }
  flush(); // trailing event with no terminating blank line

  return events;
}
