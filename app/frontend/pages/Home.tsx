import { Link } from "@remix-run/react";
import { 
  ArrowRight, 
  Bot, 
  Zap, 
  Shield, 
  Search, 
  Globe, 
  MessageSquare, 
  CheckCircle2, 
  ChevronDown,
  Layout,
  MousePointer2,
  Users,
  Play
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Logo } from "~/frontend/components/Logo";
import { ChatWidget } from "~/frontend/components/ChatWidget";
import { Footer } from "~/frontend/components/Footer";
import { Header } from "~/frontend/components/Header";
import { CTAButton } from "~/frontend/components/CTAButton";

export function HomePage() {
  return (
    <div className="min-h-screen bg-brand-bg selection:bg-primary selection:text-white overflow-x-hidden">
      <Header />
      <main className="pt-24 lg:pt-0"> {/* Offset for sticky header if needed, but Header is fixed */}
        <HeroSection />
        <TrustSection />
        <ComparisonSection />
        <FeaturesSection />
        <UseCasesSection />
        <FAQSection />
        <QuoteSection />
        <BottomCTA />
      </main>

      <Footer />
      <ChatWidget />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative px-6 pt-32 md:pt-48 pb-24 overflow-hidden">
      {/* Subtle radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl aspect-square bg-[#EEF0FF] blur-[140px] rounded-full -z-10 opacity-70" />
      
      <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 text-[11px] font-bold tracking-[0.1em] text-primary bg-primary-muted rounded-full uppercase border border-primary/10">
            ✦ AI-Powered Knowledge Platform
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold mb-8 leading-[1] tracking-[-0.03em] font-display text-brand-dark">
            AI chatbot trained <br className="hidden md:block" /> on your <span className="wordmark-gist italic text-primary">website.</span>
          </h1>
          
          <p className="text-xl text-brand-gray mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
            The AI chatbot that's an expert on your website. Instantly answer questions, capture leads, and automate support 24/7.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
            <CTAButton to="/signup" className="px-10 py-5 text-lg rounded-2xl w-full sm:w-auto">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </CTAButton>
            <CTAButton to="/login" variant="secondary" className="px-10 py-5 text-lg rounded-2xl w-full sm:w-auto">
              Sign In
            </CTAButton>
          </div>
          
          <div className="mt-12 flex items-center justify-center gap-4 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
             <div className="flex -space-x-3">
               {[1, 2, 3, 4].map(i => (
                 <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-zinc-100 overflow-hidden shadow-sm">
                   <img src={`https://i.pravatar.cc/100?img=${i+20}`} alt="User" />
                 </div>
               ))}
             </div>
             <p className="text-sm font-bold text-zinc-500">Trusted by over 1,200+ companies</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-20 w-full max-w-6xl relative"
        >
          {/* Main Product Preview Container */}
          <div className="relative rounded-[40px] border border-brand-border bg-white p-4 shadow-[0_32px_64px_-16px_rgba(21,93,238,0.15)] ring-1 ring-black/5 overflow-hidden">
            <img 
              src="/src/assets/images/sitegist_platform_hero_1779043334788.png" 
              alt="SiteGist AI Dashboard" 
              className="w-full rounded-[30px] shadow-sm border border-[#edf4fd]"
            />
            
            {/* Float Overlay: Chat Widget */}
            <div className="absolute bottom-12 right-12 w-[320px] bg-white rounded-3xl shadow-2xl border border-zinc-100 p-4 hidden md:block transform hover:-translate-y-2 transition-transform duration-500">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-brand-dark font-sans">Gist Assistant</p>
                    <p className="text-[10px] text-brand-online flex items-center gap-1 font-bold font-sans"><span className="w-1.5 h-1.5 bg-brand-online rounded-full" /> Online</p>
                  </div>
               </div>
               <div className="space-y-3">
                  <div className="bg-brand-bg p-3 rounded-2xl rounded-tl-none text-[11px] font-bold text-brand-gray border border-brand-border/50">
                    How can I help you today?
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-primary text-white p-3 rounded-2xl rounded-tr-none text-[11px] font-bold shadow-lg shadow-primary/20">
                      What are the pricing plans?
                    </div>
                  </div>
               </div>
            </div>
          </div>
          
          {/* Decorative assets */}
          <div className="absolute -z-10 top-1/2 left-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2" />
          <div className="absolute -z-10 top-1/2 right-0 w-64 h-64 bg-brand-accent/10 rounded-full blur-[100px] -translate-y-1/2" />
        </motion.div>
      </div>
    </section>
  );
}

function TrustSection() {
  const logos = ["Prisma", "Vercel", "DigitalOcean", "Supabase", "Stripe", "Clerk"];
  return (
    <section className="py-24 border-y border-brand-border bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gray mb-12">
          Trusted by high-growth product teams
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-16 gap-y-10 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-700">
           {logos.map(logo => (
             <span key={logo} className="text-2xl font-extrabold font-display tracking-tighter text-brand-dark">{logo}</span>
           ))}
        </div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  return (
    <section id="demo" className="py-32 px-6 bg-brand-bg">
      <div className="max-w-5xl mx-auto text-center mb-20">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 font-display tracking-tight text-brand-dark">
          The difference is <span className="wordmark-gist italic">instant</span> response
        </h2>
        <p className="text-lg text-brand-gray font-medium max-w-2xl mx-auto">
          Customers don't wait for your team to come online. SiteGist closes the gap between inquiry and sale in milliseconds.
        </p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-12 bg-white rounded-[32px] border border-brand-border shadow-sm">
          <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-8">
            <Clock className="w-6 h-6 text-brand-gray" />
          </div>
          <h3 className="text-2xl font-bold mb-6 font-display text-brand-dark">Traditional Support</h3>
          <ul className="space-y-4">
            <li className="flex items-start gap-4 text-brand-gray">
              <span className="w-5 h-5 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">×</span>
              Average response time: 4-6 hours
            </li>
            <li className="flex items-start gap-4 text-brand-gray">
              <span className="w-5 h-5 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">×</span>
              Unavailable during nights & weekends
            </li>
            <li className="flex items-start gap-4 text-brand-gray">
              <span className="w-5 h-5 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">×</span>
              Expensive to scale with humans
            </li>
          </ul>
        </div>

        <div className="p-12 bg-brand-dark text-white rounded-[32px] shadow-2xl shadow-brand-dark/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform duration-700" />
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-8">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-2xl font-bold mb-6 font-display">SiteGist AI Agent</h3>
          <ul className="space-y-4">
            <li className="flex items-start gap-4">
              <CheckCircle2 className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
              Instant response, 24 hours a day
            </li>
            <li className="flex items-start gap-4">
              <CheckCircle2 className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
              Automated lead capture & CRM sync
            </li>
            <li className="flex items-start gap-4">
              <CheckCircle2 className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
              Unlimited capacity at fixed cost
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="py-32 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-20">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6 font-display tracking-tight text-brand-dark">Built for modern commerce</h2>
          <p className="text-lg text-brand-gray font-normal max-w-xl leading-relaxed">Every feature is designed to turn your website visitors into happy customers.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={<Search className="w-6 h-6 text-primary" />}
            title="Auto-Crawl Engines"
            description="Our advanced spiders map your entire site, help center, and documentation in minutes. No manual data entry."
          />
          <FeatureCard 
            icon={<MessageSquare className="w-6 h-6 text-primary" />}
            title="Lead Capture Forms"
            description="Collect emails and names for follow-up automatically. SiteGist acts as your frontline sales development rep."
          />
          <FeatureCard 
            icon={<Shield className="w-6 h-6 text-primary" />}
            title="Secure Training"
            description="Your data is safe and siloed. We use enterprise-grade encryption and never leak your proprietary info."
          />
          <FeatureCard 
            icon={<Zap className="w-6 h-6 text-primary" />}
            title="Blazing Fast Latency"
            description="Powered by the latest LLMs with optimized inference to ensure near-zero lag in responses."
          />
          <FeatureCard 
            icon={<Globe className="w-6 h-6 text-primary" />}
            title="Multilingual Bot"
            description="Serve your global audience. SiteGist understands and responds in 95+ languages natively."
          />
          <FeatureCard 
            icon={<Users className="w-6 h-6 text-primary" />}
            title="Human Handover"
            description="When things get complex, seamlessly route the chat to a real human agent in your custom dashboard."
          />
        </div>
      </div>
    </section>
  );
}

function UseCasesSection() {
  const cases = [
    { industry: "SaaS & Tech", use: "Answer feature questions and technical documentation queries instantly." },
    { industry: "Real Estate", use: "Capture lead info for property listings even when agents are offline." },
    { industry: "E-commerce", use: "Handle shipping inquiries and policy questions 24/7 without a team." },
    { industry: "Healthcare", use: "Guide patients through service lists and basic appointment readiness." }
  ];

  return (
    <section id="use-cases" className="py-32 px-6 bg-brand-dark text-white rounded-[48px] mx-4 md:mx-10 mb-20">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div>
            <h2 className="text-4xl md:text-6xl font-bold mb-8 font-display leading-[1.1] tracking-tight">Different industries, <span className="wordmark-gist italic">same goal.</span></h2>
            <p className="text-xl text-brand-gray/80 font-medium mb-12 leading-relaxed">Whether you're selling software or real estate, SiteGist adapts to your unique knowledge base.</p>
            <Link to="/signup" className="inline-flex items-center gap-2 text-white bg-white/10 px-8 py-4 rounded-2xl font-bold hover:bg-white/20 transition-all border border-white/10">
               Get Started for Free <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
             {cases.map((c, i) => (
               <div key={i} className="p-8 bg-white/5 border border-white/5 rounded-3xl hover:border-brand-accent/50 transition-all group">
                 <h4 className="text-xl font-bold mb-3 font-display group-hover:text-brand-accent transition-colors">{c.industry}</h4>
                 <p className="text-sm text-white/60 leading-relaxed font-medium">{c.use}</p>
               </div>
             ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const faqs = [
    { q: "How long does training take?", a: "Most websites are crawled and trained in under 2 minutes. Once trained, your bot is live immediately." },
    { q: "Do I need coding skills?", a: "Zero. If you can copy-paste a single line of code into your website header, you're ready to go." },
    { q: "Can I customize the branding?", a: "Yes. You can change colors, logos, icons, and even the bot's tone of voice to match your brand." }
  ];

  return (
    <section className="py-32 px-6 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-extrabold mb-16 text-center font-display text-brand-dark">Frequently Asked</h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="p-8 bg-brand-bg rounded-3xl border border-brand-border">
              <h4 className="text-xl font-bold mb-4 font-display flex items-center justify-between text-brand-dark">
                {faq.q}
                <ChevronDown className="w-5 h-5 text-brand-gray/40" />
              </h4>
              <p className="text-brand-gray font-normal leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuoteSection() {
  return (
    <section className="py-32 px-6 relative overflow-hidden">
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <div className="w-20 h-20 rounded-full border-4 border-white bg-zinc-100 overflow-hidden shadow-2xl mx-auto mb-10">
          <img src="https://i.pravatar.cc/200?img=12" alt="Founder" />
        </div>
        <p className="text-2xl md:text-3xl font-extrabold font-display italic leading-tight mb-10 text-brand-dark">
          "SiteGist allowed us to automate 80% of our repetitive queries, saving us thousands in support costs while actually increasing customer satisfaction."
        </p>
        <div>
          <p className="font-extrabold text-brand-dark">Siddartha Reddy</p>
          <p className="text-[11px] font-bold text-brand-gray uppercase tracking-widest mt-1">Founder, SiteGist</p>
        </div>
      </div>
      {/* Visual Accents */}
      <div className="absolute top-1/2 left-10 -translate-y-1/2 text-[200px] font-extrabold text-brand-dark/5 select-none pointer-events-none">"</div>
      <div className="absolute top-1/2 right-10 -translate-y-1/2 text-[200px] font-extrabold text-brand-dark/5 select-none pointer-events-none">"</div>
    </section>
  );
}

function BottomCTA() {
  return (
    <section className="py-32 px-6">
      <div className="max-w-7xl mx-auto bg-primary rounded-[60px] p-20 text-center text-white shadow-2xl shadow-primary/30 relative overflow-hidden group">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.2)_0%,transparent_70%)] opacity-30" />
         <div className="relative z-10">
            <h2 className="text-5xl md:text-7xl font-black mb-8 leading-[1] font-display tracking-tight">Ready to let your <br /> knowledge fly?</h2>
            <p className="text-xl opacity-80 mb-12 max-w-xl mx-auto font-bold">Start your 14-day free trial today. No credit card required. Cancel anytime.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup" className="w-full sm:w-auto px-12 py-6 bg-white text-primary rounded-3xl font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-xl">
                 Start Free Trial
              </Link>
              <Link to="/login" className="w-full sm:w-auto px-10 py-6 bg-primary-muted/20 text-white border border-white/20 rounded-3xl font-black text-xl hover:bg-white/10 transition-all">
                 Sign In
              </Link>
            </div>
         </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-10 bg-white border border-brand-border rounded-[32px] hover:border-primary hover:shadow-2xl hover:shadow-primary/5 transition-all group relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-0 bg-primary group-hover:h-full transition-all duration-500" />
      <div className="w-14 h-14 bg-brand-bg rounded-2xl flex items-center justify-center mb-10 group-hover:bg-primary-muted group-hover:rotate-[10deg] transition-all">
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-4 font-display text-brand-dark">{title}</h3>
      <p className="text-brand-gray leading-relaxed font-normal">{description}</p>
    </div>
  );
}

const Clock = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
