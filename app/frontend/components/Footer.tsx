import { Link } from "@remix-run/react";
import { Github, Twitter, Linkedin } from "lucide-react";
import { Logo } from "./Logo";

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-white pt-24 pb-12 px-8 text-brand-dark border-t border-brand-border">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-12 mb-20">
          {/* Column 1: Brand & Contact */}
          <div>
            <Link to="/" className="inline-block mb-6 transition-transform hover:scale-[1.02]">
              <Logo size="md" variant="light" />
            </Link>
            <p className="text-brand-gray font-medium leading-relaxed mb-6 max-w-xs">
              Empowering websites with intelligent AI assistants trained on your own content. Capture leads and close deals 24/7.
            </p>
            <div className="mb-8">
              <a href="mailto:support@sitegist.co" className="text-sm font-bold text-brand-dark hover:text-brand-accent transition-colors">
                support@sitegist.co
              </a>
            </div>
            <div className="flex items-center gap-2">
              <a href="#" className="p-2.5 bg-brand-dark/5 rounded-xl hover:bg-brand-accent hover:text-white transition-all border border-brand-dark/5 text-brand-dark">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="p-2.5 bg-brand-dark/5 rounded-xl hover:bg-brand-accent hover:text-white transition-all border border-brand-dark/5 text-brand-dark">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="p-2.5 bg-brand-dark/5 rounded-xl hover:bg-brand-accent hover:text-white transition-all border border-brand-dark/5 text-brand-dark">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Column 2: Product */}
          <div>
            <h4 className="font-bold text-[10px] uppercase tracking-[0.15em] text-brand-dark/40 mb-8">Product</h4>
            <ul className="space-y-4 text-[13px] text-brand-dark/70 font-bold">
              <li><Link to="/features" className="hover:text-brand-accent transition-colors">Features</Link></li>
              <li><Link to="/pricing" className="hover:text-brand-accent transition-colors">Pricing</Link></li>
              <li><Link to="/dashboard" className="hover:text-brand-accent transition-colors">Dashboard</Link></li>
              <li><Link to="/#live-demo" className="hover:text-brand-accent transition-colors">Live Demo</Link></li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div>
             <h4 className="font-bold text-[10px] uppercase tracking-[0.15em] text-brand-dark/40 mb-8">Resources</h4>
             <ul className="space-y-4 text-[13px] text-brand-dark/70 font-bold">
               <li><Link to="/blog" className="hover:text-brand-accent transition-colors">Blog</Link></li>
               <li><Link to="/docs" className="hover:text-brand-accent transition-colors">Documentation</Link></li>
               <li><Link to="/help" className="hover:text-brand-accent transition-colors">Help Center</Link></li>
               <li><Link to="/status" className="hover:text-brand-accent transition-colors">System Status</Link></li>
             </ul>
          </div>

          {/* Column 4: AI Tools */}
          <div>
            <h4 className="font-bold text-[10px] uppercase tracking-[0.15em] text-brand-dark/40 mb-8">AI Tools</h4>
            <ul className="space-y-4 text-[13px] text-brand-dark/70 font-bold">
               <li><Link to="/tools/convert-pdf-to-markdown" className="hover:text-brand-accent transition-colors">PDF to Chatbot</Link></li>
               <li><Link to="/tools" className="hover:text-brand-accent transition-colors">Sitemap Crawler</Link></li>
               <li><Link to="/lead-generation" className="hover:text-brand-accent transition-colors">Lead Extractor</Link></li>
            </ul>
          </div>

          {/* Column 5: Legal */}
          <div>
            <h4 className="font-bold text-[10px] uppercase tracking-[0.15em] text-brand-dark/40 mb-8">Legal</h4>
            <ul className="space-y-4 text-[13px] text-brand-dark/70 font-bold">
               <li><Link to="/TrustCenter" className="hover:text-brand-accent transition-colors">Trust Portal</Link></li>
               <li><Link to="/terms" className="hover:text-brand-accent transition-colors">Terms & Conditions</Link></li>
               <li><Link to="/privacy" className="hover:text-brand-accent transition-colors">Privacy Policy</Link></li>
               <li><Link to="/refund" className="hover:text-brand-accent transition-colors">Refund Policy</Link></li>
               <li><Link to="/contact-us" className="hover:text-brand-accent transition-colors">Contact Us</Link></li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom: Legal & Copyright */}
        <div className="pt-8 border-t border-brand-dark/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
            <p className="text-[11px] text-brand-dark/30 font-bold tracking-wider uppercase">
              © {currentYear} SiteGist AI Technologies Inc. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-[11px] font-bold text-brand-dark/50 uppercase tracking-widest">
              <Link to="/compliance" className="hover:text-brand-accent transition-colors">Compliance</Link>
              <Link to="/security" className="hover:text-brand-accent transition-colors">Security</Link>
              <Link to="/contact-us" className="hover:text-brand-accent transition-colors">Contact Us</Link>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
             <span className="flex items-center gap-2 text-[11px] font-bold text-brand-online/80 uppercase tracking-widest">
               <div className="w-1.5 h-1.5 bg-brand-online rounded-full animate-pulse"></div>
               All Systems Operational
             </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
