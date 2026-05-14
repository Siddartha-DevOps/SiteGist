import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect, useState, ReactNode } from 'react';

/**
 * Client-side PostHog provider for tracking user behavior in the browser.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const key = (window as any).ENV?.VITE_POSTHOG_KEY;
    const host = (window as any).ENV?.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

    if (key && typeof window !== 'undefined') {
      posthog.init(key, {
        api_host: host,
        person_profiles: 'identified_only',
        capture_pageview: false, // Handled manually or via router
      });
    }
  }, []);

  if (!isClient) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
