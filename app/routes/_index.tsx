import type { MetaFunction } from "@remix-run/node";
import { HomePage } from "~/frontend/pages/Home";

export const meta: MetaFunction = () => {
  const title = "SiteGist — AI Chatbot for Your Website | 24/7 Customer Support";
  const description =
    "Train an AI chatbot on your website, docs, and knowledge base in minutes. SiteGist answers customer questions instantly, captures leads, and provides 24/7 support in 95+ languages. Start free.";

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SiteGist",
    url: "https://sitegist.co",
    logo: "https://sitegist.co/favicon.svg",
    description,
    sameAs: ["https://twitter.com/sitegist"],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How long does training take?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Most websites are crawled and trained in under 2 minutes. Once trained, your bot is live immediately.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need coding skills to build an AI chatbot?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Zero. If you can copy-paste a single line of code into your website header, you're ready to go.",
        },
      },
      {
        "@type": "Question",
        name: "Can I customize the AI chatbot branding?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. You can change colors, logos, icons, and even the bot's tone of voice to match your brand.",
        },
      },
      {
        "@type": "Question",
        name: "What languages does the AI chatbot support?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "SiteGist supports 95+ languages automatically. Your chatbot detects the visitor's language and responds in kind — no extra configuration required.",
        },
      },
    ],
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SiteGist",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free trial available",
    },
    description,
    url: "https://sitegist.co",
  };

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: "https://sitegist.co" },
    { property: "og:type", content: "website" },
    {
      "script:ld+json": organizationSchema,
    },
    {
      "script:ld+json": faqSchema,
    },
    {
      "script:ld+json": softwareSchema,
    },
  ];
};

export default function Index() {
  return <HomePage />;
}
