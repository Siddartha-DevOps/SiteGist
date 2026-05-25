import { Check, Loader2, ArrowRight, Star, Package, TrendingUp, Zap, Shield, Box } from "lucide-react";

interface PricingCardProps {
  name: string;           // "Starter" | "Growth" | "Scale" | "Enterprise"
  price: number | string;
  yearlyTotal: number | null;
  billingCycle: "monthly" | "yearly";
  description: string;
  features: string[];
  ctaText: string;
  popular?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  onSelect: () => void;
}

interface PlanConfig {
  stripClass: string;
  stripStyle?: React.CSSProperties;
  buttonClass: string;
  buttonStyle?: React.CSSProperties;
  iconBgClass: string;
  iconBgStyle?: React.CSSProperties;
  checkmarkClass: string;
  checkmarkStyle?: React.CSSProperties;
  labelClass: string;
  labelStyle?: React.CSSProperties;
  iconColor: string;
}

const planConfigs: Record<string, PlanConfig> = {
  starter: {
    stripClass: "",
    stripStyle: { backgroundColor: "#64748b" },
    buttonClass: "text-white hover:opacity-90 shadow-xs",
    buttonStyle: { backgroundColor: "#334155" },
    iconBgClass: "",
    iconBgStyle: { backgroundColor: "#f1f5f9" },
    checkmarkClass: "",
    checkmarkStyle: { color: "#64748b" },
    labelClass: "",
    labelStyle: { color: "#64748b" },
    iconColor: "#64748b"
  },
  growth: {
    stripClass: "",
    stripStyle: { backgroundColor: "#2563eb" },
    buttonClass: "text-white hover:opacity-90 shadow-sm",
    buttonStyle: { backgroundColor: "#2563eb" },
    iconBgClass: "",
    iconBgStyle: { backgroundColor: "#eff6ff" },
    checkmarkClass: "",
    checkmarkStyle: { color: "#2563eb" },
    labelClass: "",
    labelStyle: { color: "#2563eb" },
    iconColor: "#2563eb"
  },
  scale: {
    stripClass: "",
    stripStyle: { backgroundColor: "#7c3aed" },
    buttonClass: "text-white hover:opacity-90 shadow-sm",
    buttonStyle: { backgroundColor: "#7c3aed" },
    iconBgClass: "",
    iconBgStyle: { backgroundColor: "#f5f3ff" },
    checkmarkClass: "",
    checkmarkStyle: { color: "#7c3aed" },
    labelClass: "",
    labelStyle: { color: "#7c3aed" },
    iconColor: "#7c3aed"
  },
  enterprise: {
    stripClass: "bg-gradient-to-b from-[#f59e0b] to-[#ea580c]",
    buttonClass: "bg-gradient-to-r from-[#f59e0b] to-[#ea580c] text-white hover:opacity-95 shadow-sm",
    iconBgClass: "",
    iconBgStyle: { backgroundColor: "rgba(245, 158, 11, 0.1)" },
    checkmarkClass: "text-amber-600",
    checkmarkStyle: { color: "#ea580c" },
    labelClass: "text-amber-600",
    labelStyle: { color: "#ea580c" },
    iconColor: "#ea580c"
  }
};

const defaultPlanConfig: PlanConfig = {
  stripClass: "bg-slate-500",
  buttonClass: "bg-slate-700 text-white hover:bg-slate-600",
  iconBgClass: "bg-slate-50",
  checkmarkClass: "text-slate-600",
  labelClass: "text-slate-600",
  iconColor: "#475569"
};

export function PricingCard({
  name,
  price,
  yearlyTotal,
  billingCycle,
  description,
  features,
  ctaText,
  popular = false,
  isLoading = false,
  isDisabled = false,
  onSelect
}: PricingCardProps) {
  const normName = (name || "").toLowerCase().trim();
  const config = planConfigs[normName] || defaultPlanConfig;

  // Icons based on distinct plans
  const getIcon = (planName: string, iconColor: string) => {
    const iconProps = { className: "w-4 h-4", style: { color: iconColor } };
    switch (planName.toLowerCase()) {
      case "starter":
        return <Package {...iconProps} />;
      case "growth":
        return <TrendingUp {...iconProps} />;
      case "scale":
        return <Zap {...iconProps} />;
      case "enterprise":
        return <Shield {...iconProps} />;
      default:
        return <Box {...iconProps} />;
    }
  };

  // Divide features into two columns for split feature grid presentation
  const firstHalf = features.slice(0, Math.ceil(features.length / 2));
  const secondHalf = features.slice(Math.ceil(features.length / 2));

  // Determine button text / Enterprise exceptions
  const buttonText = name.toLowerCase() === "enterprise" ? "Contact us" : ctaText;

  const handleClick = () => {
    if (!isLoading && !isDisabled) {
      onSelect();
    }
  };

  return (
    <div
      className={`relative flex flex-col md:flex-row overflow-hidden rounded-2xl bg-white w-full transition-all duration-300 ${
        popular
          ? "border-2 border-[#93c5fd] shadow-md shadow-blue-500/5 ring-2 ring-blue-500/5"
          : "border-[0.5px] border-neutral-200 shadow-xs"
      } ${isDisabled ? "opacity-60 pointer-events-none" : ""}`}
    >
      {/* Popular Corner Ribbon */}
      {popular && (
        <div className="absolute top-0 right-0 overflow-hidden w-28 h-28 pointer-events-none z-10">
          <div className="absolute top-[18px] right-[-24px] bg-[#2563eb] text-white text-[9px] font-black uppercase tracking-widest py-1 text-center w-36 rotate-45 shadow-sm">
            Most Popular
          </div>
        </div>
      )}

      {/* 1. Left Accent Strip */}
      <div 
        className={`w-full h-1.5 md:h-auto md:w-[5px] shrink-0 ${config.stripClass}`}
        style={config.stripStyle}
      />

      {/* 2. Left Panel */}
      <div className="w-full md:w-[220px] md:min-w-[220px] md:max-w-[220px] shrink-0 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-neutral-200">
        <div>
          {/* Icon Circle + Plan Name + "Most popular" badge next to name */}
          <div className="flex items-center gap-2 flex-wrap">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${config.iconBgClass}`} 
              style={config.iconBgStyle}
            >
              {getIcon(name, config.iconColor)}
            </div>
            <span className="text-xl font-black text-neutral-900 tracking-tight">{name}</span>
            {popular && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-[#2563eb] text-[9px] font-black uppercase tracking-wider rounded-full border border-blue-100 shrink-0">
                <Star className="w-2 h-2 fill-[#2563eb]" />
                Popular
              </span>
            )}
          </div>

          {/* Large Price Display */}
          <div className="mt-4">
            {name.toLowerCase() === "enterprise" ? (
              <div className="text-2xl font-black tracking-tight text-neutral-950">
                Custom pricing
              </div>
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black tracking-tight text-neutral-950">
                  {typeof price === "number" ? `$${price}` : price}
                </span>
                <span className="text-neutral-500 text-xs font-bold leading-none">/mo</span>
              </div>
            )}

            {/* "billed $XXX yearly" subtext */}
            {billingCycle === "yearly" && yearlyTotal !== null && name.toLowerCase() !== "enterprise" && (
              <div className="text-[11px] text-neutral-500 font-semibold mt-1">
                billed <span className="font-extrabold text-[#334155]">${yearlyTotal}</span> yearly
              </div>
            )}
          </div>

          {/* Short description text */}
          <p className="text-xs text-neutral-500 mt-2 leading-relaxed font-semibold">
            {description}
          </p>
        </div>

        {/* CTA Button */}
        <div className="mt-5">
          <button
            id={`btn-${name.toLowerCase().replace(/\s+/g, "-")}`}
            type="button"
            onClick={handleClick}
            disabled={isLoading || isDisabled}
            style={config.buttonStyle}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold tracking-tight flex items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer select-none active:scale-[0.98] ${config.buttonClass} ${
              isLoading || isDisabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Loading…</span>
              </>
            ) : (
              <>
                <span>{buttonText}</span>
                {name.toLowerCase() !== "enterprise" && (
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Right Panel */}
      <div className="flex-1 p-6 md:p-8 flex flex-col justify-center">
        <span 
          className="text-[10px] font-black tracking-wider uppercase mb-4 block" 
          style={config.labelStyle}
        >
          INCLUDES:
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
          <div className="space-y-3">
            {firstHalf.map((feat, i) => (
              <div key={i} className="flex items-start gap-2.5 group">
                <Check 
                  className={`w-4 h-4 stroke-[3] mt-0.5 shrink-0 ${config.checkmarkClass}`} 
                  style={config.checkmarkStyle} 
                />
                <span className="text-xs sm:text-sm font-semibold text-neutral-700 leading-snug group-hover:text-neutral-900 transition-colors">
                  {feat}
                </span>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {secondHalf.map((feat, i) => (
              <div key={i} className="flex items-start gap-2.5 group">
                <Check 
                  className={`w-4 h-4 stroke-[3] mt-0.5 shrink-0 ${config.checkmarkClass}`} 
                  style={config.checkmarkStyle} 
                />
                <span className="text-xs sm:text-sm font-semibold text-neutral-700 leading-snug group-hover:text-neutral-900 transition-colors">
                  {feat}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
