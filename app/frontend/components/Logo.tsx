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
  
  // Brand colors
  const primaryBlue = "#155DEE";
  const darkNavy = "#101828";
  
  // For the "bright purple gradient" request, I'll use a very vibrant blue-indigo gradient
  // as it fits the "SiteGist" blue brand while providing that "bright" feeling.
  const gradientStart = "#155DEE";
  const gradientEnd = "#7C6EF0"; // Adding a touch of purple as requested for the "bright" feel

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Robot Logo Icon */}
      <svg 
        width={currentSize.icon} 
        height={currentSize.icon} 
        viewBox="0 0 72 72" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={`logoGrad-${id}`} x1="0" y1="0" x2="72" y2="72" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={gradientStart}/>
            <stop offset="100%" stopColor={gradientEnd}/>
          </linearGradient>
        </defs>
        
        {/* Antenna */}
        <circle cx="36" cy="12" r="4" fill={primaryBlue}/>
        <rect x="34.5" y="16" width="3" height="8" rx="1.5" fill={primaryBlue}/>
        
        {/* Robot Head Outer Shape */}
        <rect x="8" y="24" width="56" height="40" rx="14" fill={`url(#logoGrad-${id})`}/>
        
        {/* Face Inner Area */}
        <rect x="14" y="30" width="44" height="28" rx="8" fill={darkNavy}/>
        
        {/* Curved Smiling Eyes */}
        <path d="M22 41 C22 39 28 39 28 41" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <path d="M44 41 C44 39 50 39 50 41" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        
        {/* Small ears/accents */}
        <rect x="4" y="38" width="4" height="12" rx="2" fill={primaryBlue}/>
        <rect x="64" y="38" width="4" height="12" rx="2" fill={primaryBlue}/>
      </svg>

      {!hideText && (
        <span className={`${currentSize.text} font-bold tracking-tight font-display leading-none flex items-center`}>
          <span className={variant === "dark" ? "text-white" : "text-[#101828]"}>Site</span>
          <span className="text-[#155DEE]">Gist</span>
        </span>
      )}
    </div>
  );
}
