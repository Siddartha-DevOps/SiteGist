import { Form, Link } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import { Logo } from "~/frontend/components/Logo";
import { Turnstile } from "~/frontend/components/Turnstile";

interface SignupPageProps {
  error?: string;
  isSubmitting: boolean;
}

export function SignupPage({ error, isSubmitting }: SignupPageProps) {
  const siteKey = typeof window !== "undefined" ? (window as any).ENV?.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY : undefined;

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left Column: Branding */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-brand-dark text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(108,92,231,0.15)_0%,transparent_50%)]" />
        
        <Link to="/" className="relative z-10">
          <Logo size="lg" variant="dark" />
        </Link>
        
        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold tracking-widest uppercase mb-6 border border-white/10">
            ✦ Join 1,200+ companies
          </div>
          <h2 className="text-4xl font-extrabold font-display leading-tight mb-6">
            Scale your <span className="wordmark-gist italic">customer success</span> without scaling your team.
          </h2>
          <p className="text-brand-gray/80 leading-relaxed mb-10">
            SiteGist allows you to automate repetitive queries, saving you thousands in support costs while increasing customer satisfaction.
          </p>
        </div>

        <p className="relative z-10 text-[11px] text-white/30 font-bold tracking-widest uppercase">
          © 2026 SiteGist Technologies Inc.
        </p>
      </div>

      {/* Right Column: Form */}
      <div className="flex items-center justify-center p-8 bg-brand-bg">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-12">
            <Logo size="lg" />
          </div>
          
          <div className="bg-white p-10 rounded-[32px] border border-brand-border shadow-xl shadow-brand-dark/5">
            <h1 className="text-3xl font-extrabold font-display mb-2 text-brand-dark text-center">Get started</h1>
            <p className="text-brand-gray text-center mb-10 font-medium">Create your 14-day free trial account.</p>
            
            <Form method="post" className="space-y-6">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-brand-gray mb-2.5 ml-1">Email address</label>
                <input 
                  type="email" 
                  name="email" 
                  required 
                  className="w-full px-5 py-4 bg-brand-bg border border-brand-border rounded-2xl focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all text-brand-dark placeholder:text-brand-gray/30"
                  placeholder="name@company.com"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-brand-gray mb-2.5 ml-1">Password</label>
                <input 
                  type="password" 
                  name="password" 
                  required 
                  className="w-full px-5 py-4 bg-brand-bg border border-brand-border rounded-2xl focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all text-brand-dark placeholder:text-brand-gray/30"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div className="flex items-start gap-3 px-1">
                <input type="checkbox" required className="mt-1 w-4 h-4 rounded border-brand-border text-primary focus:ring-primary/20" />
                <p className="text-[12px] text-brand-gray leading-tight">
                  I agree to the <Link to="/terms" className="text-primary font-bold">Terms of Service</Link> and <Link to="/privacy" className="text-primary font-bold">Privacy Policy</Link>.
                </p>
              </div>
              
              {siteKey && (
                <div className="flex justify-center">
                  <Turnstile siteKey={siteKey} />
                </div>
              )}
              
              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium border border-red-100 italic">
                  {error}
                </div>
              )}
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full py-5 bg-brand-dark text-white rounded-2xl font-bold text-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center shadow-xl shadow-brand-dark/20"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create account"}
              </button>
            </Form>
            
            <p className="mt-10 text-center text-[13px] text-brand-gray font-medium">
              Already have an account? <Link to="/login" className="text-primary font-bold hover:underline">Log in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
