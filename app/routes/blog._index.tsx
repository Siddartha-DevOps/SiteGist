import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";

export const meta: MetaFunction = () => [
  { title: "Blog — AI Chatbot Tips & Resources | SiteGist" },
  {
    name: "description",
    content:
      "Customer support automation insights, AI chatbot tutorials, product updates, and tips for growing your business with AI. From the SiteGist team.",
  },
  { property: "og:title", content: "Blog — AI Chatbot Tips & Resources | SiteGist" },
  {
    property: "og:description",
    content:
      "Customer support automation insights, AI chatbot tutorials, and product updates from the SiteGist team.",
  },
];
import { useLoaderData, Link } from "@remix-run/react";
import { Footer } from "~/frontend/components/Footer";
import { Logo } from "~/frontend/components/Logo";
import { Bot, ArrowRight, Calendar, User as UserIcon, Clock, ChevronRight, Layout } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

import { BlogHeader } from "~/frontend/components/BlogHeader";

import { prisma } from "~/database/db.server";

import type { BlogPost, User as PrismaUser } from "@prisma/client";

type BlogPostWithAuthor = BlogPost & { author: PrismaUser };

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      include: { author: true }
    });
    return json({ posts, dbError: null });
  } catch (error: any) {
    console.error("[Blog] Database error:", error.message);
    const isAuthError = error.message.includes("P6002") || error.message.includes("API Key is invalid") || error.message.includes("P1010");
    return json({ 
      posts: [], 
      dbError: isAuthError ? "DATABASE_AUTH_ERROR" : "GENERAL_ERROR",
      errorMessage: error.message 
    });
  }
}

export default function BlogIndex() {
  const data = useLoaderData<typeof loader>();
  const posts = "posts" in data ? data.posts : [];
  const dbError = "dbError" in data ? data.dbError : null;
  const errorMessage = "errorMessage" in data ? data.errorMessage : null;
  
  const blogPosts = posts as unknown as BlogPostWithAuthor[];

  if (dbError) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[40px] border border-red-100 p-12 shadow-2xl shadow-red-500/5 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <Layout className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-brand-dark tracking-tight">Database Error</h2>
          <p className="text-brand-gray text-sm mb-10 leading-relaxed font-medium">
            {dbError === "DATABASE_AUTH_ERROR" 
              ? "We're having trouble connecting to the database. This usually means the API key in DATABASE_URL has expired or is invalid."
              : `A database error occurred: ${errorMessage}`}
          </p>
          <Link 
            to="/"
            className="inline-block w-full py-5 bg-brand-dark text-white rounded-2xl font-bold hover:scale-[1.02] transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg selection:bg-primary selection:text-white">
      <main className="pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-20 text-center">
            <span className="inline-block px-4 py-1.5 mb-6 text-[11px] font-bold tracking-[0.1em] text-primary bg-primary-muted rounded-full uppercase border border-primary/10">
              ✦ SiteGist Insights
            </span>
            <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-[1.1] font-display text-brand-dark tracking-tight">
              News, guides & <br className="hidden md:block" /> <span className="wordmark-gist italic">AI wisdom.</span>
            </h1>
            <p className="text-lg text-brand-gray font-medium max-w-2xl mx-auto leading-relaxed">
              Explore the latest strategies in AI automation, customer experience, and lead capture.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post, i) => (
              <motion.article 
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group flex flex-col bg-white rounded-[32px] border border-brand-border overflow-hidden hover:border-primary hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500"
              >
                <div className="aspect-[16/10] overflow-hidden relative">
                  <img 
                    src={post.coverImage || "https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=800&auto=format&fit=crop"} 
                    alt={post.title} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute top-6 left-6">
                    <span className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-2xl text-[10px] font-bold uppercase tracking-widest text-primary border border-white/20 shadow-lg">
                      {post.tags?.split(',')[0] || "Insight"}
                    </span>
                  </div>
                </div>
                
                <div className="p-10 flex-1 flex flex-col">
                  <div className="flex items-center gap-4 text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-6">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {format(new Date(post.createdAt), "MMM d, yyyy")}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 5 min read</span>
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-4 font-display text-brand-dark group-hover:text-primary transition-colors leading-tight tracking-tight">
                    {post.title}
                  </h3>
                  
                  <p className="text-brand-gray font-normal text-sm leading-relaxed mb-10 line-clamp-3">
                    {post.excerpt}
                  </p>
                  
                  <div className="mt-auto flex items-center justify-between border-t border-brand-bg pt-8">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-bg flex items-center justify-center border border-brand-border text-[10px] font-bold text-primary">
                        {post.author.email[0].toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-brand-dark">{post.author.email.split('@')[0]}</span>
                    </div>
                    <Link 
                      to={`/blog/${post.slug}`}
                      className="w-10 h-10 bg-brand-bg rounded-xl flex items-center justify-center text-brand-gray/60 group-hover:bg-primary group-hover:text-white transition-all shadow-sm"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
