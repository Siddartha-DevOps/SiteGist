import { Form, Link } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import { Logo } from "~/frontend/components/Logo";

interface LoginPageProps {
  error?: string;
  isSubmitting: boolean;
}

export function LoginPage({ error, isSubmitting }: LoginPageProps) {
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
            <h1 className="text-3xl font-extrabold font-display mb-2 text-brand-dark text-center">Welcome back</h1>
            <p className="text-brand-gray text-center mb-10 font-medium">Log in to manage your AI assistants.</p>
            
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
                <div className="flex items-center justify-between mb-2.5 ml-1">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-brand-gray">Password</label>
                  <Link to="#" className="text-[11px] font-bold text-primary hover:underline">Forgot password?</Link>
                </div>
                <input 
                  type="password" 
                  name="password" 
                  required 
                  className="w-full px-5 py-4 bg-brand-bg border border-brand-border rounded-2xl focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all text-brand-dark placeholder:text-brand-gray/30"
                  placeholder="••••••••"
                />
              </div>
              
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
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign in"}
              </button>
            </Form>
            
            <p className="mt-10 text-center text-[13px] text-brand-gray font-medium">
              Don't have an account? <Link to="/signup" className="text-primary font-bold hover:underline">Start free trial</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
