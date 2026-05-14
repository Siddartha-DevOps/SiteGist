import { Link } from "@remix-run/react";
import { Logo } from "./Logo";
import { NavLink } from "./NavLink";
import { CTAButton } from "./CTAButton";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function BlogHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: "Features", to: "/#features" },
    { label: "Pricing", to: "/dashboard/billing" },
    { label: "Security", to: "/#security" },
    { label: "Go to Home", to: "/" },
  ];

  return (
    <nav className="bg-white border-b border-brand-border py-4">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="transition-transform hover:scale-[1.02] flex items-center gap-2">
          <Logo size="md" />
          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-widest">Blog</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <NavLink key={link.label} to={link.to}>{link.label}</NavLink>
          ))}
        </div>

        {/* Actions */}
        <div className="hidden lg:flex items-center gap-4">
          <CTAButton to="/signup" variant="primary">Get Started</CTAButton>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="lg:hidden p-2 text-brand-dark"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-brand-border p-6 shadow-xl">
          <div className="flex flex-col gap-6">
            {navLinks.map((link) => (
              <Link 
                key={link.label} 
                to={link.to} 
                className="text-lg font-bold text-brand-dark"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-4">
              <CTAButton to="/signup" variant="primary" className="w-full">Get Started</CTAButton>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
