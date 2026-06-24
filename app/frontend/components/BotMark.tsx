import { useId } from "react";
import type { CSSProperties } from "react";

export type BotFace = "idle" | "thinking" | "happy";

/**
 * SiteGist brand mark — a friendly robot face with headphones on a blue→indigo
 * gradient circle. Single source of truth for the logo icon (Logo wordmark + chat
 * widget). The `variant` swaps the expression: idle (smile), thinking (O mouth),
 * happy (closed eyes + grin). Size via `className` (e.g. "w-16 h-16") or `style`.
 */
export function BotMark({
  className = "",
  style,
  variant = "idle",
}: {
  className?: string;
  style?: CSSProperties;
  variant?: BotFace;
}) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SiteGist">
      <defs>
        <linearGradient id={`bm-${id}`} x1="18" y1="8" x2="82" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4F63E0" />
          <stop offset="1" stopColor="#7A4CE0" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#bm-${id})`} />
      {/* headphone band */}
      <path d="M27 53 V46 a23 23 0 0 1 46 0 V53" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
      {/* ear cups */}
      <rect x="20" y="48" width="9" height="17" rx="4.5" fill="#fff" />
      <rect x="71" y="48" width="9" height="17" rx="4.5" fill="#fff" />
      {/* face */}
      <rect x="33" y="40" width="34" height="33" rx="12" fill="none" stroke="#fff" strokeWidth="3.4" />

      {variant === "happy" ? (
        <>
          {/* closed happy eyes */}
          <path d="M40 55 q3 -3.5 6 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <path d="M54 55 q3 -3.5 6 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          {/* big grin */}
          <path d="M41 59 q9 9 18 0" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
        </>
      ) : variant === "thinking" ? (
        <>
          <circle cx="43" cy="53" r="2.1" fill="#fff" />
          <circle cx="57" cy="53" r="2.1" fill="#fff" />
          {/* surprised "O" mouth */}
          <circle cx="50" cy="62" r="3.3" fill="none" stroke="#fff" strokeWidth="3" />
        </>
      ) : (
        <>
          <circle cx="43" cy="54" r="2.1" fill="#fff" />
          <circle cx="57" cy="54" r="2.1" fill="#fff" />
          {/* gentle smile */}
          <path d="M42.5 61 q7.5 6 15 0" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
