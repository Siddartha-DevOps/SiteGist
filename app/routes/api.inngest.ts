/**
 * Inngest serve endpoint. Inngest (cloud or the local dev server) calls this URL
 * to discover and invoke our durable functions. Remix resource routes require
 * both a loader (GET) and an action (POST/PUT) export.
 */
import { serve } from "inngest/remix";
import { inngest } from "~/inngest/client";
import { functions } from "~/inngest/functions";

const handler = serve({ client: inngest, functions });

export { handler as loader, handler as action };
