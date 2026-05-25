import { Link } from "@remix-run/react";
import { useState, useEffect } from "react";
import { Logo } from "./Logo";
import { NavLink } from "./NavLink";
import { CTAButton } from "./CTAButton";
import { Menu, X } from "lucide-react";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Lead Generation", to: "/lead-generation" },
    { label: "Features", to: "/features" },
    { label: "Integrations", to: "/integrations" },
    { label: "Pricing", to: "/pricing" },
    { label:  "Security", to: "/security"},
    { label: "Tools", to: "/tools" },
    { label: "Blog", to: "/blog" },
  ];

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
        isScrolled 
          ? "bg-white/95 backdrop-blur-xl border-blue-500/20 py-3 shadow-[0_6px_30px_rgba(37,99,235,0.08)]" 
          : "bg-white/90 backdrop-blur-md border-blue-100 py-4 shadow-[0_4px_20px_rgba(37,99,235,0.04)]"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="transition-transform hover:scale-[1.02] flex items-center gap-2">
          <Logo size="md" />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <NavLink key={link.label} to={link.to}>{link.label}</NavLink>
          ))}
        </div>

        {/* Actions */}
        <div className="hidden lg:flex items-center gap-4">
          <CTAButton to="/login" variant="text">Sign In</CTAButton>
          <CTAButton to="/signup" variant="primary">Start Free Trial</CTAButton>
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
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-b border-brand-border p-6 shadow-xl animate-in slide-in-from-top duration-300">
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
            <hr className="border-brand-border" />
            <div className="flex flex-col gap-4">
              <CTAButton to="/login" variant="secondary" className="w-full">Sign In</CTAButton>
              <CTAButton to="/signup" variant="primary" className="w-full">Start Free Trial</CTAButton>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
