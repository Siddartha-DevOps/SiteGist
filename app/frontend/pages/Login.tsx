import { Form, Link } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import { Logo } from "~/frontend/components/Logo";
import { Turnstile } from "@marsidev/react-turnstile";

interface LoginPageProps {
  error?: string;
  success?: boolean;
  sentEmail?: string;
  isSubmitting: boolean;
}

export function LoginPage({ error, success, sentEmail, isSubmitting }: LoginPageProps) {
  const siteKey = typeof window !== "undefined" ? (window as any).ENV?.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY : undefined;

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg p-8">
        <div className="w-full max-w-md bg-white p-10 rounded-[32px] border border-brand-border shadow-xl text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold font-display mb-4 text-brand-dark">Check your email</h1>
          <p className="text-brand-gray mb-8 font-medium leading-relaxed">
            We've sent a magic login link to <span className="text-brand-dark font-bold">{sentEmail}</span>. 
            Click the link in the email to log in automatically.
          </p>
          <Link to="/login" className="text-primary font-bold hover:underline">Try another email</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left Column: Branding */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-brand-dark text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(108,92,231,0.15)_0%,transparent_50%)]" />
        
        <Link to="/" className="relative z-10">
          <Logo size="lg" variant="dark" />
        </Link>
        
        <div className="relative z-10 max-w-lg">
          <h2 className="text-4xl font-extrabold font-display leading-tight mb-6">
            Building the next generation of <span className="wordmark-gist italic">customer support</span>.
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-white/20 overflow-hidden">
              <img src="https://i.pravatar.cc/100?img=12" alt="User" />
            </div>
            <div>
              <p className="font-bold text-sm">Siddartha Reddy</p>
              <p className="text-xs text-white/40 uppercase tracking-widest mt-0.5">Founder, SiteGist</p>
            </div>
          </div>
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
            <h1 className="text-3xl font-extrabold font-display mb-2 text-brand-dark text-center">Sign In</h1>
            <p className="text-brand-gray text-center mb-10 font-medium">Enter your email for a passwordless magic link.</p>
            
            <Form method="post" className="space-y-6">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-brand-gray mb-2.5 ml-1">Email address</label>
                <input 
                  type="email" 
                  name="email" 
                  required 
                  autoFocus
                  className="w-full px-5 py-4 bg-brand-bg border border-brand-border rounded-2xl focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all text-brand-dark placeholder:text-brand-gray/30 font-sans"
                  placeholder="name@company.com"
                />
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
                className="w-full py-5 bg-primary text-white rounded-2xl font-bold text-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center shadow-2xl shadow-primary/30"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Login Link"}
              </button>
            </Form>
            
            <p className="mt-10 text-center text-[13px] text-brand-gray font-medium leading-relaxed">
              New to SiteGist? <Link to="/signup" className="text-primary font-bold hover:underline">Start free trial</Link>. <br/>
              No password needed — just click the link we send you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
