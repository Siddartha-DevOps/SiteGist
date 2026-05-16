import { Header } from "~/frontend/components/Header";
import { Footer } from "~/frontend/components/Footer";
import { ChatWidget } from "~/frontend/components/ChatWidget";
import { CTAButton } from "~/frontend/components/CTAButton";
import { 
  Zap, 
  MessageSquare, 
  Target, 
  Shield, 
  BarChart3, 
  Cpu, 
  Globe, 
  Code2,
  Database,
  Users2
} from "lucide-react";

export default function Features() {
  const features = [
    {
      title: "Smart Website Crawling",
      description: "Our advanced crawler navigates your site, extracts content, and understands your business context automatically.",
      icon: <Globe className="w-6 h-6 text-brand-accent" />,
      color: "bg-brand-accent/10"
    },
    {
      title: "Natural Conversations",
      description: "Powered by deep learning models that handle nuanced questions and stay within your brand's safe boundaries.",
      icon: <MessageSquare className="w-6 h-6 text-brand-online" />,
      color: "bg-brand-online/10"
    },
    {
      title: "Active Lead Capture",
      description: "Don't just chat—convert. Your bot identifies interest, asks for contact info, and syncs directly to your CRM.",
      icon: <Target className="w-6 h-6 text-orange-500" />,
      color: "bg-orange-500/10"
    },
    {
      title: "Multi-Source Training",
      description: "Upload PDFs, Word docs, Notion pages, or paste raw text. Your AI integrates knowledge from every format.",
      icon: <Database className="w-6 h-6 text-purple-500" />,
      color: "bg-purple-500/10"
    },
    {
      title: "Custom Branding",
      description: "Style your widget to match your brand perfectly. Custom colors, avatars, and welcome messages in seconds.",
      icon: <Zap className="w-6 h-6 text-yellow-500" />,
      color: "bg-yellow-500/10"
    },
    {
      title: "Advanced Analytics",
      description: "See what your customers are asking. Track conversion rates, popular topics, and lead quality in real-time.",
      icon: <BarChart3 className="w-6 h-6 text-blue-500" />,
      color: "bg-blue-500/10"
    },
    {
      title: "Enterprise Grade Security",
      description: "SOC2 Type II compliant. We use industry-standard encryption and data isolation to keep your training data safe.",
      icon: <Shield className="w-6 h-6 text-gray-700" />,
      color: "bg-gray-700/10"
    },
    {
      title: "Developer API",
      description: "Integrate SiteGist into your own apps. Access chat history, trigger actions, and manage bots via our REST API.",
      icon: <Code2 className="w-6 h-6 text-green-500" />,
      color: "bg-green-500/10"
    }
  ];

  return (
    <div className="bg-white min-h-screen">
      <div className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 text-brand-accent text-xs font-bold uppercase tracking-widest mb-6 leading-none">
            <Cpu className="w-3 h-3" />
            Cutting Edge Technology
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-brand-dark mb-6 tracking-tight">
            The power of AI, <span className="text-brand-accent">built for business.</span>
          </h1>
          <p className="text-xl text-brand-gray max-w-2xl mx-auto">
            SiteGist combines advanced language models with high-performance crawling to create the ultimate customer interaction engine.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-32">
          {features.map((feature) => (
            <div key={feature.title} className="p-8 rounded-3xl border border-brand-border hover:border-brand-accent/30 transition-all duration-300 group">
              <div className={`w-12 h-12 ${feature.color} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                {feature.icon}
              </div>
              <h3 className="text-lg font-extrabold text-brand-dark mb-3 tracking-tight">{feature.title}</h3>
              <p className="text-sm text-brand-gray leading-relaxed font-medium">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Feature Spotlight */}
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-32 bg-brand-light/40 rounded-[40px] p-8 md:p-16">
          <div>
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-8">
              <Users2 className="w-6 h-6 text-brand-accent" />
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-brand-dark mb-6 tracking-tight">Human-in-the-loop training</h2>
            <p className="text-lg text-brand-gray mb-8 leading-relaxed">
              Review every conversation. If the AI doesn't know an answer, you can train it instantly. Our active learning system improves with every interaction.
            </p>
            <ul className="space-y-4 mb-10">
              <li className="flex items-center gap-3 font-bold text-brand-dark text-sm">
                <div className="w-1.5 h-1.5 bg-brand-accent rounded-full"></div>
                Real-time conversation monitoring
              </li>
              <li className="flex items-center gap-3 font-bold text-brand-dark text-sm">
                <div className="w-1.5 h-1.5 bg-brand-accent rounded-full"></div>
                Instant answer correction
              </li>
              <li className="flex items-center gap-3 font-bold text-brand-dark text-sm">
                <div className="w-1.5 h-1.5 bg-brand-accent rounded-full"></div>
                Custom "fallback" behaviors
              </li>
            </ul>
            <CTAButton to="/signup" variant="primary" className="px-10 py-5">Try it Yourself</CTAButton>
          </div>
          <div className="relative">
            <div className="bg-white rounded-3xl shadow-2xl p-6 border border-brand-border relative z-10">
               <div className="flex items-center justify-between mb-6 border-b border-brand-border pb-4">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-accent rounded-full flex items-center justify-center text-white font-bold">SG</div>
                    <div>
                      <div className="text-sm font-extrabold text-brand-dark">SiteGist AI Assistant</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-brand-online font-bold uppercase tracking-wider">
                         <div className="w-1 h-1 bg-brand-online rounded-full animate-pulse"></div>
                         Online & Learning
                      </div>
                    </div>
                 </div>
               </div>
               <div className="space-y-4 mb-6">
                 <div className="bg-brand-light p-4 rounded-2xl rounded-tl-none mr-12 text-sm font-medium text-brand-dark/80">
                   "How do I set up my custom domain?"
                 </div>
                 <div className="bg-brand-accent/5 p-4 rounded-2xl rounded-tr-none ml-12 text-sm font-medium text-brand-dark border border-brand-accent/10">
                   "You can set up a custom domain in your Dashboard under 'Settings &gt; Widget'. Just add your CNAME record!"
                 </div>
                 <div className="bg-brand-online/10 p-3 rounded-xl text-[11px] font-bold text-brand-online text-center border border-brand-online/20">
                   System improved the confidence score for this answer.
                 </div>
               </div>
            </div>
            {/* Background elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-brand-accent/10 blur-3xl opacity-50"></div>
          </div>
        </div>

        <div className="text-center py-20 border-t border-brand-border">
          <h2 className="text-3xl font-extrabold text-brand-dark mb-6">Ready to see SiteGist in action?</h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <CTAButton to="/signup" variant="primary" className="px-12 py-5 text-base">Get Started for Free</CTAButton>
            <CTAButton to="/contact-us" variant="secondary" className="px-12 py-5 text-base">Talk to an Expert</CTAButton>
          </div>
        </div>
      </div>
      <Footer />
      <ChatWidget />
    </div>
  );
}
