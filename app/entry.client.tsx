import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { initClientErrorReporting } from "./lib/sentry.client";

// Capture uncaught client errors / rejections to Sentry (no-op without a DSN).
initClientErrorReporting();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
