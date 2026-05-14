import { PostHog } from 'posthog-node';

/**
 * Server-side PostHog tracking for backend events.
 */
let _posthog: PostHog | null = null;

export function getPosthog() {
  if (!_posthog) {
    const key = process.env.VITE_POSTHOG_KEY;
    const host = process.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

    if (!key) {
      console.warn("PostHog key missing.");
      return null;
    }

    _posthog = new PostHog(key, { host });
  }
  return _posthog;
}

export function captureEvent(userId: string, event: string, properties?: any) {
  const ph = getPosthog();
  if (ph) {
    ph.capture({
      distinctId: userId,
      event,
      properties,
    });
  }
}
