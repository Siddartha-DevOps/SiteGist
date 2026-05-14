import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Footer } from "~/frontend/components/Footer";
import { 
  Bot, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Share2, 
  Bookmark, 
} from "lucide-react";
import { format } from "date-fns";
import { prisma } from "~/database/db.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || !data.post) {
    return [{ title: "Blog Post Not Found | SiteGist" }];
  }
  const { post } = data;
  const title = post.seoTitle || post.metaTitle || post.title;
  const description = post.seoDescription || post.metaDescription || post.excerpt;
  
  return [
    { title: `${title} | SiteGist` },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: post.coverImage },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
};

import type { BlogPost, User } from "@prisma/client";

type BlogPostWithAuthor = BlogPost & { author: User };

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug: params.slug },
      include: { author: true }
    });
    
    if (!post || !post.published) {
      throw new Response("Not Found", { status: 404 });
    }

    const relatedPosts = await prisma.blogPost.findMany({
      where: { 
        published: true,
        id: { not: post.id }
      },
      take: 3,
      orderBy: { createdAt: 'desc' }
    });

    return json({ post, relatedPosts, dbError: null });
  } catch (error: any) {
    if (error instanceof Response) throw error; // Re-throw 404s
    console.error("[Blog Detail] Database error:", error.message);
    const isAuthError = error.message.includes("P6002") || error.message.includes("API Key is invalid") || error.message.includes("P1010");
    return json({ 
      post: null, 
      relatedPosts: [], 
      dbError: isAuthError ? "DATABASE_AUTH_ERROR" : "GENERAL_ERROR",
      errorMessage: error.message 
    });
  }
}

export default function BlogPost() {
  const data = useLoaderData<typeof loader>();
  const post = "post" in data ? data.post : null;
  const dbError = "dbError" in data ? data.dbError : null;
  const errorMessage = "errorMessage" in data ? data.errorMessage : null;
  
  const blogPost = post as unknown as BlogPostWithAuthor;

  if (dbError) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <h2 className="text-2xl font-bold mb-4">Error Loading Post</h2>
          <p className="text-zinc-500 mb-8">{errorMessage}</p>
          <Link to="/blog" className="text-primary font-bold">Back to Blog</Link>
        </div>
      </div>
    );
  }

  if (!blogPost) return null;

  return (
    <div className="min-h-screen bg-brand-bg selection:bg-primary selection:text-white">
      <main className="pb-32">
        <div className="max-w-4xl mx-auto px-6">
          <Link to="/blog" className="inline-flex items-center gap-2 text-brand-gray/60 font-bold text-[11px] uppercase tracking-widest mt-12 mb-12 hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Blog
          </Link>

          <header className="mb-16">
            <div className="flex items-center gap-4 mb-8">
               <span className="px-4 py-1.5 bg-primary-muted text-primary text-[10px] font-bold uppercase tracking-widest rounded-full border border-primary/10">
                 ✦ {blogPost.tags?.split(',')[0] || "Insight"}
               </span>
               <div className="flex items-center gap-4 text-[10px] font-bold text-brand-gray/50 uppercase tracking-widest border-l border-brand-border pl-4">
                 <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {format(new Date(blogPost.createdAt), "MMM d, yyyy")}</span>
                 <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 5 min read</span>
               </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold mb-12 leading-[1.1] font-display text-brand-dark tracking-tight">
              {blogPost.title}
            </h1>

            <div className="flex items-center justify-between pb-8 border-b border-brand-border">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-brand-bg flex items-center justify-center border border-brand-border shadow-sm overflow-hidden text-xs font-bold text-primary">
                    {blogPost.author.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-brand-dark">{blogPost.author.email.split('@')[0]}</p>
                    <p className="text-[11px] font-bold text-brand-gray uppercase tracking-widest mt-0.5">{blogPost.author.role}</p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <button className="p-3 bg-white rounded-xl text-brand-gray/40 hover:text-primary transition-colors border border-brand-border">
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button className="p-3 bg-white rounded-xl text-brand-gray/40 hover:text-primary transition-colors border border-brand-border">
                    <Bookmark className="w-5 h-5" />
                  </button>
               </div>
            </div>
          </header>

          <div className="rounded-[40px] overflow-hidden shadow-2xl mb-20 border border-brand-border ring-8 ring-brand-bg">
            <img src={blogPost.coverImage || "https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=1200&auto=format&fit=crop"} alt={blogPost.title} className="w-full object-cover aspect-[2/1]" />
          </div>

          <div className="prose prose-brand-dark prose-xl max-w-none prose-headings:font-bold prose-headings:font-display prose-headings:tracking-tight prose-blockquote:border-primary prose-blockquote:bg-primary-muted prose-blockquote:p-10 prose-blockquote:rounded-[32px] prose-blockquote:not-italic prose-blockquote:font-bold prose-blockquote:text-primary prose-a:text-primary mb-20 px-4 md:px-0 text-brand-dark/90 leading-relaxed font-sans">
             <div dangerouslySetInnerHTML={{ __html: blogPost.content }} />
          </div>

          <div className="bg-brand-dark rounded-[48px] p-16 border border-white/5 text-center text-white relative overflow-hidden group">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(108,92,231,0.2)_0%,transparent_70%)] opacity-30" />
            <Bot className="w-16 h-16 text-brand-accent mx-auto mb-8 opacity-20 relative z-10" />
            <h3 className="text-3xl md:text-4xl font-bold mb-6 font-display relative z-10">Capture more leads <span className="wordmark-gist italic">today</span>.</h3>
            <p className="text-brand-gray/80 font-medium mb-10 max-w-md mx-auto relative z-10">Join thousands of businesses already using SiteGist to automate their customer knowledge.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
              <Link to="/signup" className="px-10 py-5 bg-primary text-white rounded-2xl font-bold shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all">
                Get Started Free
              </Link>
              <Link to="/dashboard/billing" className="px-10 py-5 bg-white/10 text-white border border-white/10 rounded-2xl font-bold hover:bg-white/20 transition-all">
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
