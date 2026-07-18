import { Inngest } from "inngest";

/**
 * Shared Inngest client. The `id` identifies this app in the Inngest dashboard.
 * In production set INNGEST_EVENT_KEY (to send events) and INNGEST_SIGNING_KEY
 * (to secure the serve endpoint). Locally, run `npx inngest-cli dev` and set
 * INNGEST_DEV=1 to route ingestion through the durable pipeline.
 */
export const inngest = new Inngest({ id: "sitegist" });

// Event names (kept here so producers and consumers can't drift).
export const INGEST_SOURCE_EVENT = "ingest/source.requested" as const;

export type IngestSourceEvent = {
  name: typeof INGEST_SOURCE_EVENT;
  data: { projectId: string; sourceId: string; force?: boolean };
};
