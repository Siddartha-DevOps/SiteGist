import React from "react";
import { BotMark } from "./BotMark";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  hideText?: boolean;
  variant?: "light" | "dark";
}

export function Logo({ className = "", size = "md", hideText = false, variant = "light" }: LogoProps) {
  const sizes = {
    sm: { icon: 24, text: "text-lg" },
    md: { icon: 32, text: "text-xl" },
    lg: { icon: 48, text: "text-3xl" },
    xl: { icon: 64, text: "text-4xl" },
  };
  const currentSize = sizes[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <BotMark className="shrink-0" style={{ width: currentSize.icon, height: currentSize.icon }} />
      {!hideText && (
        <span className={`${currentSize.text} font-bold tracking-tight font-display leading-none flex items-center`}>
          <span className={variant === "dark" ? "text-white" : "text-[#101828]"}>Site</span>
          <span className="text-[#155DEE]">Gist</span>
        </span>
      )}
    </div>
  );
}
