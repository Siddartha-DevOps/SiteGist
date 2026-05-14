import { Link } from "@remix-run/react";

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
}

export function NavLink({ to, children }: NavLinkProps) {
  return (
    <Link 
      to={to} 
      className="text-sm font-medium text-brand-gray hover:text-brand-dark transition-all relative group"
    >
      {children}
      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
    </Link>
  );
}
