import React, { useId } from "react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  hideText?: boolean;
  variant?: "light" | "dark";
}

export function Logo({ className = "", size = "md", hideText = false, variant = "light" }: LogoProps) {
  const id = useId();
  const sizes = {
    sm: { icon: 24, text: "text-lg" },
    md: { icon: 32, text: "text-xl" },
    lg: { icon: 48, text: "text-3xl" },
    xl: { icon: 64, text: "text-4xl" },
  };

  const currentSize = sizes[size];
  
  // Color logic for variants
  const bgGradStart = variant === "dark" ? "#9B8FF8" : "#7C6EF0";
  const bgGradEnd = variant === "dark" ? "#7C6EF0" : "#5A4CD6";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Refined SVG Logo Icon */}
      <svg 
        width={currentSize.icon} 
        height={currentSize.icon} 
        viewBox="0 0 72 72" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={`bgGrad-${id}`} x1="0" y1="0" x2="72" y2="72" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={bgGradStart}/>
            <stop offset="100%" stopColor={bgGradEnd}/>
          </linearGradient>
          <linearGradient id={`shineGrad-${id}`} x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="white" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="white" stopOpacity="0"/>
          </linearGradient>
          <filter id={`shadow-${id}`} x="-20%" y="-10%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#6C5CE7" floodOpacity="0.35"/>
          </filter>
        </defs>
        
        {/* Main rounded square */}
        <rect x="2" y="2" width="64" height="64" rx="18" fill={`url(#bgGrad-${id})`} filter={`url(#shadow-${id})`}/>
        
        {/* Shine overlay */}
        <rect x="2" y="2" width="64" height="34" rx="18" fill={`url(#shineGrad-${id})`}/>
        
        {/* Chat tail */}
        <path d="M20 54 L14 64 L32 58" fill={variant === "dark" ? "#7C6EF0" : "#5A4CD6"}/>
        
        {/* Robot Face */}
        <circle cx="28" cy="30" r="5" fill="white"/>
        <circle cx="44" cy="30" r="5" fill="white"/>
        <circle cx="29.5" cy="31.5" r="2.2" fill="#7C6EF0"/>
        <circle cx="45.5" cy="31.5" r="2.2" fill="#7C6EF0"/>
        
        {/* Smile arc */}
        <path d="M28 42 Q36 48 44 42" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        
        {/* Knowledge lines (subtle gist indicators) */}
        <rect x="22" y="20" width="10" height="2" rx="1" fill="white" opacity="0.3"/>
        <rect x="40" y="20" width="10" height="2" rx="1" fill="white" opacity="0.3"/>
      </svg>

      {!hideText && (
        <span className={`${currentSize.text} font-black tracking-tighter font-display leading-none flex items-center`}>
          <span className={variant === "dark" ? "text-white" : "text-brand-dark"}>site</span>
          <span className="wordmark-gist">gist</span>
        </span>
      )}
    </div>
  );
}
