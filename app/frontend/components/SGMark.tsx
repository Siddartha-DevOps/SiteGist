import { useId } from "react";

/**
 * SiteGist "SG" app-mark — a rounded blue→indigo gradient tile with a bold "SG"
 * and a sparkle, used as the floating chat-widget logo.
 */
export function SGMark({ className = "w-12 h-12" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 512 512" className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SiteGist">
      <defs>
        <linearGradient id={`sg-${id}`} x1="48" y1="24" x2="472" y2="496" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4F63E0" />
          <stop offset="1" stopColor="#7A4CE0" />
        </linearGradient>
      </defs>
      <rect x="12" y="12" width="488" height="488" rx="128" fill={`url(#sg-${id})`} />
      <text
        x="244"
        y="352"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
        fontSize="300"
        fontWeight="800"
        fill="#ffffff"
      >
        SG
      </text>
      {/* sparkle, top-right above the G */}
      <path d="M398 86 l14 32 32 14 -32 14 -14 32 -14 -32 -32 -14 32 -14 z" fill="#ffffff" />
    </svg>
  );
}
