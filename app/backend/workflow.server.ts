import { Client } from "@upstash/workflow";

/**
 * Upstash Workflow allows you to build reliable, long-running processes.
 * Perfect for background jobs like indexing an entire website.
 */
let _workflow: Client | null = null;

export function getWorkflow() {
  if (!_workflow) {
    const url = process.env.UPSTASH_WORKFLOW_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      console.warn("Upstash Workflow credentials missing.");
      return null;
    }

    _workflow = new Client({
      baseUrl: url,
      token,
    });
  }
  return _workflow;
}

/**
 * Define your workflow routes in a Remix resource route.
 * E.g., app/routes/api.workflow.ts
 */
