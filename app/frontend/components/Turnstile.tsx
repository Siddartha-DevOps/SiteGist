import { useEffect, useRef } from "react";

interface TurnstileProps {
  siteKey: string;
  options?: {
    theme?: "light" | "dark" | "fallback";
  };
}

export function Turnstile({ siteKey, options }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const initTurnstile = () => {
      if (!active) return;
      
      const turnstile = (window as any).turnstile;
      if (turnstile && containerRef.current) {
        try {
          // Clear any residual elements before render
          containerRef.current.innerHTML = "";
          
          const id = turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: options?.theme || "light",
          });
          widgetIdRef.current = id;
        } catch (err) {
          console.warn("[Turnstile] Explicit render failed, falling back to implicit:", err);
        }
      }
    };

    if (typeof window !== "undefined") {
      const existingScript = document.getElementById("cloudflare-turnstile-script");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "cloudflare-turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback";
        script.async = true;
        script.defer = true;
        
        (window as any).onloadTurnstileCallback = () => {
          if (active) {
            initTurnstile();
          }
        };

        document.body.appendChild(script);
      } else {
        if ((window as any).turnstile) {
          initTurnstile();
        } else {
          const interval = setInterval(() => {
            if ((window as any).turnstile) {
              clearInterval(interval);
              initTurnstile();
            }
          }, 100);
          return () => {
            active = false;
            clearInterval(interval);
          };
        }
      }
    }

    return () => {
      active = false;
      if (widgetIdRef.current && (window as any).turnstile) {
        try {
          (window as any).turnstile.remove(widgetIdRef.current);
        } catch (err) {
          // Ignore
        }
      }
    };
  }, [siteKey, options?.theme]);

  return (
    <div 
      ref={containerRef} 
      className="cf-turnstile-container min-h-[65px] flex items-center justify-center w-full min-w-[250px]" 
    />
  );
}
