/**
 * Reusable checkout launcher utility for Paddle.js v2
 */

// --- TypeScript Declarations ---

export interface PaddleCheckoutItem {
  priceId: string;
  quantity: number;
}

export interface PaddleCheckoutSettings {
  displayMode?: "overlay" | "inline";
  theme?: "light" | "dark";
  locale?: string;
  successUrl?: string;
}

export interface PaddleCheckoutCustomer {
  email?: string;
}

export interface PaddleEvent {
  name: string;
  data?: any;
}

export interface PaddleCheckoutOpenOptions {
  items: PaddleCheckoutItem[];
  settings?: PaddleCheckoutSettings;
  customer?: PaddleCheckoutCustomer;
  customData?: Record<string, any>;
  eventCallback?: (event: PaddleEvent) => void;
}

export interface PaddleSDK {
  Environment: {
    set: (env: "sandbox" | "production") => void;
  };
  Initialize: (options: { token: string }) => void;
  Checkout: {
    open: (options: PaddleCheckoutOpenOptions) => void;
    close: () => void;
  };
}

declare global {
  interface Window {
    Paddle?: PaddleSDK;
  }
}

// --- Checkout Launcher State & Settings ---

interface OpenCheckoutParams {
  priceId: string;
  customerEmail?: string;
  successUrl?: string;
  customData?: Record<string, any>;
  theme?: "light" | "dark";
  locale?: string;
  
  // Callbacks
  onLoaded?: () => void;
  onClosed?: () => void;
  onCompleted?: (data: any) => void;
  onSuccess?: (data: any) => void;
  onFailure?: (error: any) => void;
}

// Track checkout presentation status
let isCheckoutOpen = false;

/**
 * Initiates the Paddle secure checkout window overlay.
 * Throws functional errors and guards against duplicate execution.
 */
export async function openCheckout({
  priceId,
  customerEmail,
  successUrl,
  customData,
  theme = "light",
  locale = "en",
  onLoaded,
  onClosed,
  onCompleted,
  onSuccess,
  onFailure
}: OpenCheckoutParams): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // 1. Verify existence of Paddle global loader SDK
    if (typeof window === "undefined") {
      const err = new Error("Paddle.js cannot be executed on the server-side.");
      onFailure?.(err);
      return reject(err);
    }

    const paddleInstance = window.Paddle;
    if (!paddleInstance) {
      const err = new Error(
        "Paddle SDK was not found on window. Ensure https://cdn.paddle.com/paddle/v2/paddle.js is loaded successfully."
      );
      onFailure?.(err);
      return reject(err);
    }

    // 2. Prevent duplicate checkout presentation crashes
    if (isCheckoutOpen) {
      const err = new Error("A payment checkout flow is already active.");
      onFailure?.(err);
      return reject(err);
    }

    if (!priceId) {
      const err = new Error("A valid Paddle Price ID is required to initiate checkout.");
      onFailure?.(err);
      return reject(err);
    }

    try {
      isCheckoutOpen = true;

      // 3. Configure Paddle item arguments
      const items: PaddleCheckoutItem[] = [{ priceId, quantity: 1 }];

      // 4. Fire Checkout.open
      paddleInstance.Checkout.open({
        items,
        settings: {
          displayMode: "overlay",
          theme: theme,
          locale: locale,
          ...(successUrl ? { successUrl } : {})
        },
        customer: customerEmail ? { email: customerEmail } : undefined,
        customData: customData,
        eventCallback: (event: PaddleEvent) => {
          console.log(`[Paddle Event] ${event.name}`, event);

          switch (event.name) {
            case "checkout.loaded":
              onLoaded?.();
              break;

            case "checkout.closed":
              isCheckoutOpen = false;
              onClosed?.();
              break;

            case "checkout.completed":
              isCheckoutOpen = false;
              onCompleted?.(event.data);
              onSuccess?.(event.data);
              break;

            case "checkout.payment.failed":
              onFailure?.(event.data || new Error("Payment transaction failed."));
              break;

            case "checkout.payment.completed":
              onSuccess?.(event.data);
              break;

            default:
              break;
          }
        }
      });

      resolve();
    } catch (err: any) {
      isCheckoutOpen = false;
      onFailure?.(err);
      reject(err);
    }
  });
}
