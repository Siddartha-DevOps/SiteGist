import { motion } from "framer-motion";
import { Check, Sparkles, Box, Package, TrendingUp, Zap, Shield, Info } from "lucide-react";
import { CheckoutButton } from "./CheckoutButton";

interface PricingCardProps {
  name: string;
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
  const isCustomPrice = typeof price === "string";

  // Map tier name to custom React icon with elegant colors
  const getIcon = () => {
    switch (name) {
      case "Starter":
        return (
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
            <Package className="w-4 h-4" />
          </div>
        );
      case "Growth":
        return (
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-blue-600 border border-indigo-100">
            <TrendingUp className="w-4 h-4" />
          </div>
        );
      case "Scale":
        return (
          <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center text-blue-600 border border-cyan-100">
            <Zap className="w-4 h-4" />
          </div>
        );
      case "Enterprise":
        return (
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-blue-600 border border-purple-100">
            <Shield className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Box className="w-4 h-4" />
          </div>
        );
    }
  };

  // Divide features into 2 columns for beautiful symmetrical layout
  const col1Features = features.slice(0, Math.ceil(features.length / 2));
  const col2Features = features.slice(Math.ceil(features.length / 2));

  return (
    <div
      className={`relative rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row gap-6 lg:gap-10 transition-all duration-300 border-2 w-full bg-white ${
        popular
          ? "border-blue-600 ring-4 ring-blue-500/20 shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_40px_rgba(37,99,235,0.45)] hover:border-blue-700"
          : "border-blue-400 ring-2 ring-blue-500/5 shadow-[0_0_20px_rgba(37,99,235,0.15)] hover:shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:border-blue-500"
      }`}
    >
      {/* Left Part: Title, Price and Button */}
      <div className="flex flex-col justify-between w-full lg:w-[280px] shrink-0">
        <div>
          {/* Header Row */}
          <div className="flex items-center gap-2.5">
            {getIcon()}
            <span className="text-2xl font-black text-neutral-900 tracking-tight">{name}</span>
            {popular && (
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-wider rounded-md border border-blue-100">
                Popular
              </span>
            )}
          </div>

          {/* Pricing area */}
          <div className="mt-5 mb-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-5xl font-black tracking-tight text-neutral-950">
                {isCustomPrice ? price : `$${price}`}
              </span>
              {!isCustomPrice && (
                <span className="text-neutral-500 text-base font-bold">/mo</span>
              )}
            </div>

            {!isCustomPrice && yearlyTotal !== null && (
              <div className="text-sm text-neutral-500 font-semibold mt-1.5">
                billed <span className="font-extrabold text-neutral-900">${yearlyTotal}</span> yearly
              </div>
            )}

            <p className="text-sm text-neutral-500 mt-3 leading-relaxed font-semibold">
              {description}
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="mt-3">
          {name === "Enterprise" && isCustomPrice ? (
            <a
              id="enterprise-link"
              href="mailto:bhanu@sitegpt.ai"
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all border bg-neutral-950 hover:bg-neutral-800 text-white shadow-xs"
            >
              Contact us
            </a>
          ) : (
            <CheckoutButton
              id={`btn-${name.toLowerCase().replace(/\s+/g, "-")}`}
              text={ctaText}
              onClick={onSelect}
              isLoading={isLoading}
              isDisabled={isDisabled}
              variant={popular ? "popular" : "secondary"}
            />
          )}
        </div>
      </div>

      {/* Right Part: Included features */}
      <div className="flex-1 lg:border-l lg:border-neutral-200/60 lg:pl-8 flex flex-col justify-center">
        <span className="text-xs font-black tracking-wider uppercase block text-neutral-400 mb-4">
          INCLUDES:
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {/* Column 1 of Features */}
          <div className="space-y-3.5">
            {col1Features.map((feat, i) => (
              <div key={i} className="flex items-center gap-3">
                <Check className="w-4.5 h-4.5 text-blue-600 stroke-[3.5] shrink-0" />
                <div className="flex items-center gap-1">
                  <span className="text-sm sm:text-base font-semibold text-neutral-800 hover:text-blue-600 transition-colors border-b border-dotted border-neutral-300">
                    {feat}
                  </span>
                  <Info className="w-3.5 h-3.5 text-neutral-300 hover:text-neutral-500 transition-colors cursor-pointer shrink-0" />
                </div>
              </div>
            ))}
          </div>

          {/* Column 2 of Features */}
          <div className="space-y-3.5">
            {col2Features.map((feat, i) => (
              <div key={i} className="flex items-center gap-3">
                <Check className="w-4.5 h-4.5 text-blue-600 stroke-[3.5] shrink-0" />
                <div className="flex items-center gap-1">
                  <span className="text-sm sm:text-base font-semibold text-neutral-800 hover:text-blue-600 transition-colors border-b border-dotted border-neutral-300">
                    {feat}
                  </span>
                  <Info className="w-3.5 h-3.5 text-neutral-300 hover:text-neutral-500 transition-colors cursor-pointer shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
  );
}
