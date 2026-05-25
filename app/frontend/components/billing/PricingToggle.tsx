import { motion } from "framer-motion";

interface PricingToggleProps {
  billingCycle: "monthly" | "yearly";
  onChange: (cycle: "monthly" | "yearly") => void;
  savingsPercentage?: number;
}

export function PricingToggle({
  billingCycle,
  onChange,
  savingsPercentage = 40
}: PricingToggleProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div 
        id="pricing-toggle-wrapper"
        className="inline-flex items-center gap-1 p-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-2xl relative shadow-inner"
      >
        {/* Monthly Option Button */}
        <button
          id="toggle-monthly"
          type="button"
          onClick={() => onChange("monthly")}
          className={`px-5 py-2.5 text-sm font-black rounded-xl transition-all relative z-10 select-none ${
            billingCycle === "monthly"
              ? "text-neutral-900 dark:text-white"
              : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
          }`}
        >
          {billingCycle === "monthly" && (
            <motion.div
              layoutId="active-pricing-toggle"
              className="absolute inset-0 bg-white dark:bg-neutral-800 rounded-xl shadow-md border border-neutral-200/30 dark:border-neutral-700/30"
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
            />
          )}
          <span className="relative z-10">Monthly Billing</span>
        </button>

        {/* Yearly Option Button */}
        <button
          id="toggle-yearly"
          type="button"
          onClick={() => onChange("yearly")}
          className={`px-5 py-2.5 text-sm font-black rounded-xl transition-all relative z-10 select-none flex items-center gap-2 ${
            billingCycle === "yearly"
              ? "text-neutral-900 dark:text-white"
              : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
          }`}
        >
          {billingCycle === "yearly" && (
            <motion.div
              layoutId="active-pricing-toggle"
              className="absolute inset-0 bg-white dark:bg-neutral-800 rounded-xl shadow-md border border-neutral-200/30 dark:border-neutral-700/30"
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
            />
          )}
          <span className="relative z-10">Yearly Billing</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          Choose yearly billing for premium savings
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20 animate-pulse">
          Save {savingsPercentage}%
        </span>
      </div>
    </div>
  );
}
