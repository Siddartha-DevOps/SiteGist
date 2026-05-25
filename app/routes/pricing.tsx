import { useState, useMemo, useEffect } from "react";
import { Header } from "~/frontend/components/Header";
import { Footer } from "~/frontend/components/Footer";
import { Check, Sparkles, Minus, Plus, ArrowRight, Zap, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatWidget } from "~/frontend/components/ChatWidget";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getUser } from "~/backend/auth.server";

type BillingCycle = "monthly" | "yearly";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  return json({
    user,
    PADDLE_CLIENT_TOKEN: process.env.VITE_PADDLE_CLIENT_TOKEN || "live_7ff4397f21e4828fcac29997974",
    PADDLE_STARTER_PLAN_ID: process.env.VITE_PADDLE_STARTER_PLAN_ID || "pri_01kqpebd19q7nppxkh53e0cnd3", // Default starter plan ID
    PADDLE_BASIC_PLAN_ID: process.env.VITE_PADDLE_GROWTH_PLAN_ID || process.env.VITE_PADDLE_BASIC_PLAN_ID || "pri_01kqpe8ad9772rdsn3ddbw4bg3",
    PADDLE_PRO_PLAN_ID: process.env.VITE_PADDLE_SCALE_PLAN_ID || process.env.VITE_PADDLE_PRO_PLAN_ID || "pri_01kqpe9hv3r1v9wfxxvnjgq9zk"
  });
}

export default function Pricing() {
  const loaderData = useLoaderData<typeof loader>();
  const user = loaderData?.user || null;
  const PADDLE_CLIENT_TOKEN = loaderData?.PADDLE_CLIENT_TOKEN || "";
  const PADDLE_STARTER_PLAN_ID = loaderData?.PADDLE_STARTER_PLAN_ID || "";
  const PADDLE_BASIC_PLAN_ID = loaderData?.PADDLE_BASIC_PLAN_ID || "";
  const PADDLE_PRO_PLAN_ID = loaderData?.PADDLE_PRO_PLAN_ID || "";

  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [calcPlan, setCalcPlan] = useState("Growth");
  const [modelSplit, setModelSplit] = useState(50); // 0 = 100% GPT-4o-mini, 100 = 100% GPT-4o
  const [isInsideIframe, setIsInsideIframe] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsInsideIframe(window.self !== window.top);
    }
  }, []);

  // Safe client-side Paddle initialization on load
  useEffect(() => {
    // @ts-ignore
    if (typeof Paddle !== 'undefined') {
      try {
        const clientToken = PADDLE_CLIENT_TOKEN || (window as any).ENV?.VITE_PADDLE_CLIENT_TOKEN || "test_99bce225540de757f831d4cc5f5";
        // @ts-ignore
        Paddle.Environment.set(clientToken.startsWith('test_') ? 'sandbox' : 'production');
        // @ts-ignore
        Paddle.Initialize({ 
          token: clientToken
        });
      } catch (err) {
        console.warn("[Paddle Init] Failed to initialize:", err);
      }
    }
  }, [PADDLE_CLIENT_TOKEN]);

  const handlePlanSelect = (planName: string) => {
    if (isInsideIframe) {
      setCheckoutError("Payment security note: Checkout cannot trigger safely within the nested AI Studio preview iframe. Please click the 'Open in New Tab' button in the top-right of your workspace toolbar to complete your subscription trial in a secure window.");
      return;
    }

    // Determine target price ID
    let priceId = "";
    if (planName === "Starter") {
      priceId = PADDLE_STARTER_PLAN_ID || "pri_01kqpebd19q7nppxkh53e0cnd3";
    } else if (planName === "Growth") {
      priceId = PADDLE_BASIC_PLAN_ID || "pri_01kqpe8ad9772rdsn3ddbw4bg3";
    } else if (planName === "Scale") {
      priceId = PADDLE_PRO_PLAN_ID || "pri_01kqpe9hv3r1v9wfxxvnjgq9zk";
    }

    // @ts-ignore
    if (typeof Paddle !== 'undefined') {
      try {
        // @ts-ignore
        Paddle.Checkout.open({ 
          items: [
            {
              priceId: priceId,
              quantity: 1
            }
          ],
          customer: {
            email: user?.email || ""
          },
          customData: {
            userId: user?.id || ""
          }
        });
      } catch (err) {
        console.error("Paddle Checkout open failed:", err);
        setCheckoutError("Failed to launch secure checkout. Please try again.");
      }
    } else {
      setCheckoutError(`Demo Mode: Securing checkout session for plan "${planName}" (ID: ${priceId}). Register first or check your console.`);
    }
  };

  const plans = [
    {
      name: "Starter",
      price: billingCycle === "monthly" ? 39 : 31,
      yearlyTotal: 468,
      description: "Essential features for individuals and small sites.",
      features: ["1 chatbot", "Up to 4k messages per month", "Up to 1,000 pages", "Manual refresh", "1 team member"],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      name: "Growth",
      price: billingCycle === "monthly" ? 79 : 63,
      yearlyTotal: 948,
      description: "Enhanced capabilities for growing businesses.",
      features: [
        "Up to 2 chatbots",
        "Up to 10k messages",
        "Up to 10,000 pages",
        "Manual refresh",
        "Up to 4 team members",
        "Integrations",
        "API access",
        "Rate limiting",
        "Auto refresh (monthly)",
      ],
      cta: "Start Free Trial",
      popular: true,
    },
    {
      name: "Scale",
      price: billingCycle === "monthly" ? 259 : 207,
      yearlyTotal: 3108,
      description: "Maximum performance for professional content creators.",
      features: [
        "Up to 3 chatbots",
        "Up to 40k messages",
        "Up to 50k pages",
        "Up to 10 team members",
        "Integrations/API access",
        "Rate limiting",
        "Auto refresh weekly",
        "Auto scan daily",
        "Webhook support",
      ],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      name: "Enterprise",
      price: "Custom",
      yearlyTotal: null,
      description: "Full control for large organizations and networks.",
      features: [
        "Up to 10,000 chatbots",
        "Custom message volume",
        "Up to 500k pages",
        "Up to 10,000 members",
        "Priority support",
        "Custom integrations",
        "HIPAA eligible",
        "Signed DPA",
        "Custom BAA",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  const calculatorResult = useMemo(() => {
    // Basic logic for message count based on plan and model cost ratio (roughly 10x diff)
    const baseMessages = calcPlan === "Starter" ? 4000 : calcPlan === "Growth" ? 10000 : calcPlan === "Scale" ? 40000 : 1000000;
    
    // GPT-4o-mini is much cheaper, so it gets more messages
    // Let's assume the baseMessages are GPT-4o equivalent units
    // Split: 0 = 100% Mini, 100 = 100% GPT-4o
    // Mini multiplier = 10x
    
    const weightGPT4o = modelSplit / 100;
    const weightMini = 1 - weightGPT4o;
    
    const messages4o = Math.round(baseMessages * weightGPT4o);
    const messagesMini = Math.round(baseMessages * weightMini * 10);
    
    return {
      messages4o,
      messagesMini,
      total: messages4o + messagesMini
    };
  }, [calcPlan, modelSplit]);

  return (
    <div className="bg-white min-h-screen font-sans selection:bg-primary/20">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-brand-light/50 to-transparent -z-10 blur-3xl opacity-50" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-dark/5 border border-brand-border text-brand-dark text-xs font-black uppercase tracking-widest mb-8"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          Simple, Transparent Pricing
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-black text-brand-dark mb-6 tracking-tight leading-[1.1]"
        >
          Choose the plan that's<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-brand-accent to-primary animate-gradient">right for your growth</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-xl text-brand-gray/80 max-w-2xl mx-auto mb-12 font-medium"
        >
          Scale your customer interactions with intelligent AI. Start free and upgrade as you grow.
        </motion.p>

        {/* Billing Toggle */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-6 mb-16"
        >
          <span className={`text-sm font-black transition-colors ${billingCycle === "monthly" ? "text-brand-dark" : "text-brand-gray"}`}>Pay Monthly</span>
          <button 
            onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
            className="w-14 h-8 bg-brand-dark rounded-full p-1 relative flex items-center transition-colors group"
          >
            <motion.div 
              animate={{ x: billingCycle === "monthly" ? 0 : 24 }}
              className="w-6 h-6 bg-white rounded-full shadow-lg"
            />
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-black transition-colors ${billingCycle === "yearly" ? "text-brand-dark" : "text-brand-gray"}`}>Pay Yearly</span>
            <span className="px-2 py-0.5 bg-brand-online text-white rounded-full text-[10px] font-black uppercase tracking-tighter animate-pulse">Save 40%</span>
          </div>
        </motion.div>

        {/* Environment Warnings & Sandbox Banner */}
        <AnimatePresence>
          {checkoutError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-amber-50 border border-amber-200 text-amber-950 p-6 rounded-[24px] mb-12 max-w-4xl mx-auto shadow-sm text-left flex items-start justify-between gap-4"
            >
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-black tracking-tight text-amber-950 uppercase mb-1">Secure Checkout Sandbox Info</h4>
                  <p className="text-xs font-semibold leading-relaxed text-amber-800">
                    {checkoutError}
                  </p>
                  {isInsideIframe && (
                    <div className="pt-2">
                      <a 
                        href="/pricing" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] uppercase tracking-wider px-4 py-2 rounded-xl transition-all shadow-sm"
                      >
                        Open in New Tab
                      </a>
                    </div>
                  )}
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setCheckoutError(null)}
                className="text-amber-400 hover:text-amber-600 font-extrabold text-xs uppercase tracking-wider px-2 py-1 bg-white hover:bg-amber-100 rounded-lg border border-amber-100 transition-colors shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
              className={`group relative p-8 rounded-[32px] border transition-all duration-500 overflow-hidden ${
                plan.popular 
                  ? "bg-brand-dark text-white shadow-2xl scale-[1.02] border-brand-accent/50" 
                  : "bg-white border-brand-border text-brand-dark hover:border-brand-dark/20 hover:scale-[1.01]"
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 p-4">
                  <div className="bg-brand-accent text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-brand-accent/20">
                    Most Popular
                  </div>
                </div>
              )}
              
              <div className="mb-8">
                <h3 className={`text-xl font-black mb-1 ${plan.popular ? "text-white" : "text-brand-dark"}`}>{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-black">
                    {typeof plan.price === "number" ? `$${plan.price}` : plan.price}
                  </span>
                  {typeof plan.price === "number" && (
                    <span className={`text-sm font-medium ${plan.popular ? "text-white/60" : "text-brand-gray"}`}>/mo</span>
                  )}
                </div>
                {billingCycle === "yearly" && typeof plan.price === "number" && (
                  <p className={`text-[11px] font-black uppercase tracking-widest mb-4 opacity-100 ${plan.popular ? "text-brand-accent" : "text-primary"}`}>
                    ${plan.yearlyTotal} Billed annually
                  </p>
                )}
                <p className={`text-sm leading-relaxed font-medium ${plan.popular ? "text-white/70" : "text-brand-gray"}`}>
                  {plan.description}
                </p>
              </div>

              {plan.name === "Enterprise" ? (
                <a 
                  href="/contact-us"
                  className={`w-full py-4 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 group/btn ${
                    plan.popular 
                      ? "bg-white text-brand-dark hover:bg-brand-accent hover:text-white" 
                      : "bg-brand-dark text-white hover:bg-primary"
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                </a>
              ) : (
                <button 
                  type="button"
                  onClick={() => handlePlanSelect(plan.name)}
                  className={`w-full py-4 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 group/btn cursor-pointer ${
                    plan.popular 
                      ? "bg-white text-brand-dark hover:bg-brand-accent hover:text-white" 
                      : "bg-brand-dark text-white hover:bg-primary"
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                </button>
              )}

              <div className="mt-10 space-y-4">
                <p className={`text-[10px] font-black uppercase tracking-widest ${plan.popular ? "text-white/40" : "text-brand-gray/40"}`}>What's Included</p>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className={`mt-0.5 p-0.5 rounded-full ${plan.popular ? "bg-white/10 text-brand-accent" : "bg-primary/5 text-primary"}`}>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                      <span className={`text-[13px] font-semibold ${plan.popular ? "text-white/80" : "text-brand-dark/80"}`}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Decorative Gradient for Popular Plan */}
              {plan.popular && (
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-brand-accent/20 blur-[60px] rounded-full pointer-events-none" />
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Calculator Section */}
      <section className="py-24 px-6 bg-brand-light/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-brand-dark mb-4 tracking-tight">AI Message Cost Calculator</h2>
            <p className="text-brand-gray font-medium">Estimate your message capacity based on the AI model you choose.</p>
          </div>

          <div className="bg-white rounded-[40px] border border-brand-border shadow-2xl shadow-brand-dark/5 p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              {/* Controls */}
              <div className="space-y-10">
                <div className="space-y-4">
                  <label className="text-[13px] font-black text-brand-gray uppercase tracking-widest ml-1">Current Plan</label>
                  <div className="flex flex-wrap gap-2">
                    {["Starter", "Growth", "Scale"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setCalcPlan(p)}
                        className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                          calcPlan === p 
                            ? "bg-brand-dark text-white scale-105 shadow-lg shadow-brand-dark/20" 
                            : "bg-brand-light text-brand-gray hover:bg-brand-border"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between ml-1 text-[13px] font-black text-brand-gray uppercase tracking-widest">
                    <span>Performance (AI Hybrid)</span>
                    <div className="flex items-center gap-2">
                      <span className="text-primary">{modelSplit}% Super-power</span>
                    </div>
                  </div>
                  <div className="relative h-6 flex items-center">
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={modelSplit}
                      onChange={(e) => setModelSplit(parseInt(e.target.value))}
                      className="w-full h-2 bg-brand-light rounded-full appearance-none cursor-pointer accent-primary border border-brand-border"
                    />
                  </div>
                  <div className="flex justify-between px-1">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-brand-accent uppercase tracking-tighter">GPT-4o mini</p>
                      <p className="text-[9px] text-brand-gray">Highest Volume</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-primary uppercase tracking-tighter">GPT-4o (Standard)</p>
                      <p className="text-[9px] text-brand-gray">Highest Logic</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Output */}
              <div className="bg-brand-dark rounded-[32px] p-8 text-white flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="relative z-10">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 mb-8">Estimated Monthly Volume</p>
                  
                  <div className="space-y-6">
                    <div className="flex items-end justify-between border-b border-white/10 pb-4">
                      <div>
                        <p className="text-white/60 text-[11px] font-bold uppercase mb-1">GPT-4o mini</p>
                        <p className="text-2xl font-black">{calculatorResult.messagesMini.toLocaleString()}</p>
                      </div>
                      <p className="text-[10px] font-black text-brand-accent">90% CHEAPER</p>
                    </div>
                    
                    <div className="flex items-end justify-between border-b border-white/10 pb-4">
                      <div>
                        <p className="text-white/60 text-[11px] font-bold uppercase mb-1">GPT-4o (High IQ)</p>
                        <p className="text-2xl font-black">{calculatorResult.messages4o.toLocaleString()}</p>
                      </div>
                      <p className="text-[10px] font-black text-primary">NATIVE</p>
                    </div>

                    <div className="pt-4">
                      <p className="text-white/60 text-[11px] font-bold uppercase mb-1">Combined Total</p>
                      <p className="text-5xl font-black text-brand-accent tabular-nums">
                        {calculatorResult.total.toLocaleString()}
                        <span className="text-lg text-white/40 ml-2 font-black uppercase tracking-tighter">msgs</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-12 relative z-10">
                  <button 
                    type="button"
                    onClick={() => handlePlanSelect(calcPlan)}
                    className="w-full py-4 bg-brand-accent text-white rounded-2xl font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-brand-accent/20 cursor-pointer"
                  >
                    Get Started with {calcPlan}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-12 p-12 rounded-[40px] bg-white border border-brand-border shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 blur-[80px] rounded-full translate-x-20 -translate-y-20" />
          
          <div className="max-w-md text-left relative z-10">
            <h3 className="text-2xl font-black text-brand-dark mb-4 tracking-tight">Need more power?</h3>
            <p className="text-brand-gray font-medium">Customize your plan with enterprise-grade add-ons for total control.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full md:w-auto relative z-10">
            <div className="p-6 rounded-3xl bg-brand-light/50 border border-brand-border flex items-center justify-between gap-8 group hover:bg-white hover:border-primary transition-all">
              <div>
                <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em] mb-1">White-label</p>
                <p className="text-lg font-black text-brand-dark">Remove Branding</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-brand-dark">$39</p>
                <p className="text-[9px] font-black text-brand-gray uppercase">Monthly</p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-brand-light/50 border border-brand-border flex items-center justify-between gap-8 group hover:bg-white hover:border-primary transition-all">
              <div>
                <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em] mb-1">Capacity</p>
                <p className="text-lg font-black text-brand-dark">Extra 5k Messages</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-brand-dark">$39</p>
                <p className="text-[9px] font-black text-brand-gray uppercase">Monthly</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs or secondary CTA */}
      <section className="py-24 px-6 bg-brand-dark text-white overflow-hidden relative">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 blur-[120px] rounded-full" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Zap className="w-12 h-12 text-brand-accent mx-auto mb-8 animate-pulse shadow-brand-accent/50" />
          <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">Ready to transform your<br />customer experience?</h2>
          <p className="text-white/60 mb-12 text-lg font-medium">Join thousands of high-growth companies using SiteGist AI.</p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/signup" className="px-10 py-5 bg-white text-brand-dark rounded-2xl font-black text-lg hover:scale-105 transition-all shadow-2xl shadow-white/10">
              Get Started for Free
            </a>
            <a href="/contact-us" className="px-10 py-5 bg-white/10 text-white border border-white/20 rounded-2xl font-black text-lg hover:bg-white/20 transition-all">
              Talk to Our Experts
            </a>
          </div>
          
          <div className="mt-20 pt-20 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <p className="text-3xl font-black mb-1">99.9%</p>
              <p className="text-[11px] font-black uppercase tracking-widest text-white/40">Uptime SLA</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1">24/7</p>
              <p className="text-[11px] font-black uppercase tracking-widest text-white/40">Real Expert Support</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1">100ms</p>
              <p className="text-[11px] font-black uppercase tracking-widest text-white/40">Avg. Response Time</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1">Zero</p>
              <p className="text-[11px] font-black uppercase tracking-widest text-white/40">Hidden Fees</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <ChatWidget />
    </div>
  );
}
