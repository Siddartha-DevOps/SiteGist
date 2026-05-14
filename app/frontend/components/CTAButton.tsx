import { Link } from "@remix-run/react";

interface CTAButtonProps {
  to?: string;
  variant?: "primary" | "secondary" | "text";
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function CTAButton({ to, variant = "primary", children, className = "", onClick }: CTAButtonProps) {
  const baseStyles = "px-6 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-primary text-white shadow-lg shadow-primary/20 hover:brightness-110",
    secondary: "bg-white text-brand-dark border border-brand-border hover:bg-zinc-50",
    text: "text-brand-gray hover:text-brand-dark px-4 py-2",
  };

  const combinedClassName = `${baseStyles} ${variants[variant]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={combinedClassName}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={combinedClassName}>
      {children}
    </button>
  );
}
