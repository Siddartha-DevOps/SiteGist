import { serve } from "inngest/remix";
import { inngest } from "~/inngest/client.server";
import { functions } from "~/inngest/functions.server";

const handler = serve({ client: inngest, functions });

// Remix resource route: both GET (loader) and POST/PUT (action) must be handled.
export const loader = handler;
export const action = handler;
