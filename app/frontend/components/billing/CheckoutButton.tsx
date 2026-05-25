import { motion } from "framer-motion";
import { Loader2, ArrowRight } from "lucide-react";

interface CheckoutButtonProps {
  id?: string;
  text: string;
  onClick: () => void;
  isLoading?: boolean;
  isDisabled?: boolean;
  variant?: "primary" | "secondary" | "popular";
}

export function CheckoutButton({
  id,
  text,
  onClick,
  isLoading = false,
  isDisabled = false,
  variant = "primary"
}: CheckoutButtonProps) {
  // Styles based on premium look & feel
  const baseClasses =
    "w-full py-3.5 px-6 rounded-2xl text-sm font-black flex items-center justify-center gap-2.5 transition-all duration-300 relative overflow-hidden select-none cursor-pointer border";

  const variantClasses = {
    primary:
      "bg-neutral-950 hover:bg-neutral-900 text-white border-neutral-950 dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-950 dark:border-white shadow-sm hover:shadow-md",
    secondary:
      "bg-white hover:bg-[#155DEE]/5 text-[#155DEE] border-[#155DEE] dark:bg-neutral-950 dark:text-[#528eff] dark:border-[#155DEE]/50 dark:hover:bg-[#155DEE]/10 font-bold shadow-xs transition-colors duration-200",
    popular:
      "bg-[#155DEE] hover:bg-[#124ec6] text-white border-[#155DEE] hover:border-[#124ec6] shadow-md shadow-[#155DEE]/15 hover:shadow-lg font-bold transition-colors duration-200"
  };

  const currentVariant = variantClasses[variant] || variantClasses.primary;

  return (
    <motion.button
      id={id || "checkout-button"}
      type="button"
      onClick={(e) => {
        if (!isLoading && !isDisabled) {
          onClick();
        }
      }}
      disabled={isDisabled || isLoading}
      whileHover={!isDisabled && !isLoading ? { scale: 1.01 } : {}}
      whileTap={!isDisabled && !isLoading ? { scale: 0.99 } : {}}
      className={`${baseClasses} ${currentVariant} ${
        isDisabled || isLoading ? "opacity-50 !cursor-not-allowed pointer-events-none" : ""
      } rounded-xl py-3.5`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>Processing...</span>
        </>
      ) : (
        <span className="tracking-tight text-sm font-semibold">{text}</span>
      )}
    </motion.button>
  );
}
