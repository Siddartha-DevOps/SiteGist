import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { chunkText, getSitemapUrls, crawlUrl } from "~/ai-layer/crawler.server";
import { upsertChunks } from "~/ai-layer/ai.server";
import { Globe, Search, Loader2, List, ChevronLeft, Type, Video, FileText, Upload, Zap, RefreshCw, Clock, Database, HelpCircle, Plus, Edit, Trash2, ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { Link } from "@remix-run/react";
import { useState, useEffect } from "react";
import { 
  unstable_createMemoryUploadHandler, 
  unstable_parseMultipartFormData 
} from "@remix-run/node";
import { parsePdf, parseDocx } from "~/ai-layer/crawler.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
    include: { 
      integrations: true,
      knowledgeSources: { orderBy: { createdAt: 'desc' } },
      knowledgeQAs: { orderBy: { createdAt: 'desc' } }
    }
  });
  if (!project) return redirect("/dashboard");
  return json({ project });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  
  let formData;
  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("multipart/form-data")) {
    const uploadHandler = unstable_createMemoryUploadHandler({
      maxPartSize: 10 * 1024 * 1024, // 10MB
    });
    formData = await unstable_parseMultipartFormData(request, uploadHandler);
  } else {
    formData = await request.formData();
  }
  
  const url = formData.get("url") as string;
  const method = formData.get("_action");

  if (method === "delete_source") {
    const sourceId = formData.get("id") as string;
    const source = await prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
    if (source) {
      const { deleteSourceChunks } = await import("~/ai-layer/ai.server");
      await deleteSourceChunks(params.projectId!, source.type === 'web' ? source.source : source.title || source.source);
      await prisma.knowledgeSource.delete({ where: { id: sourceId } });
    }
    return json({ success: true, message: "Source removed and vector data cleaned successfully" });
  }

  if (method === "add_qa") {
    const question = (formData.get("question") as string || "").trim();
    const answer = (formData.get("answer") as string || "").trim();

    if (!question || !answer) {
      return json({ error: "Both question and answer are required." }, { status: 400 });
    }
    if (question.length > 500) {
      return json({ error: "Question cannot exceed 500 characters." }, { status: 400 });
    }
    if (answer.length > 5000) {
      return json({ error: "Answer cannot exceed 5000 characters." }, { status: 400 });
    }

    const existingQA = await prisma.knowledgeQA.findFirst({
      where: {
        projectId: params.projectId!,
        question: { equals: question, mode: "insensitive" }
      }
    });

    if (existingQA) {
      return json({ error: "A Q&A entry with this exact question already exists." }, { status: 400 });
    }

    await prisma.knowledgeQA.create({
      data: {
        projectId: params.projectId!,
        question,
        answer,
        triggerCount: 0
      }
    });

    return json({ success: true, message: "Manual Q&A entry added successfully!" });
  }

  if (method === "edit_qa") {
    const id = formData.get("id") as string;
    const question = (formData.get("question") as string || "").trim();
    const answer = (formData.get("answer") as string || "").trim();

    if (!id || !question || !answer) {
      return json({ error: "ID, question and answer are required." }, { status: 400 });
    }
    if (question.length > 500 || answer.length > 5000) {
      return json({ error: "Question or answer size limit exceeded." }, { status: 400 });
    }

    const existingQA = await prisma.knowledgeQA.findFirst({
      where: {
        projectId: params.projectId!,
        question: { equals: question, mode: "insensitive" },
        id: { not: id }
      }
    });

    if (existingQA) {
      return json({ error: "Another Q&A entry with this exact question already exists." }, { status: 400 });
    }

    await prisma.knowledgeQA.update({
      where: { id },
      data: { question, answer }
    });

    return json({ success: true, message: "Manual Q&A entry updated successfully!" });
  }

  if (method === "delete_qa") {
    const id = formData.get("id") as string;
    if (!id) return json({ error: "Missing Q&A entry ID." }, { status: 400 });

    await prisma.knowledgeQA.delete({
      where: { id }
    });

    return json({ success: true, message: "Manual Q&A entry deleted successfully!" });
  }

  if (!url && method !== "add_text" && method !== "upload_file") {
    return json({ error: "URL is required" }, { status: 400 });
  }

  if (method === "crawl_single") {
    try {
      const data = await crawlUrl(url);
      if (!data) {
        return json({ error: "Could not crawl or fetch the page. Please verify the URL and try again." }, { status: 400 });
      }
      const content = data.content || "";
      const title = data.title || url;

      const existing = await prisma.knowledgeSource.findFirst({
        where: { projectId: params.projectId, source: url, type: "web" },
      });

      if (existing) {
        await prisma.knowledgeSource.update({
          where: { id: existing.id },
          data: { title, content },
        });
      } else {
        await prisma.knowledgeSource.create({
          data: {
            projectId: params.projectId!,
            type: "web",
            source: url,
            title,
            content,
          },
        });
      }

      const chunks = chunkText(content);
      await upsertChunks(params.projectId!, chunks.map(c => ({ text: c, metadata: { url, title } })));

      return json({ success: true, message: "Page crawled and indexed successfully" });
    } catch (e: any) {
      return json({ error: `Crawl Error: ${e.message}` }, { status: 400 });
    }
  }

  if (method === "add_text") {
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    
    await prisma.knowledgeSource.create({
      data: {
        projectId: params.projectId!,
        type: "text",
        source: title,
        title,
        content,
      },
    });

    const chunks = chunkText(content);
    await upsertChunks(params.projectId!, chunks.map(c => ({ text: c, metadata: { title } })));

    return json({ success: true, message: "Text content added and indexed successfully" });
  }

  if (method === "add_youtube") {
    const videoUrl = formData.get("url") as string;
    const {
      getYoutubeTranscript,
      detectYouTubeUrlType,
      extractPlaylistId,
      extractChannelHandle,
      getPlaylistVideos,
      getChannelVideos,
      getVideoTitle,
    } = await import("~/ai-layer/crawler.server");

    const urlType = detectYouTubeUrlType(videoUrl);
    const VIDEO_CAP = 20; // max per request to avoid timeout

    // Resolve to array of { id: string, title: string }
    let videos: { id: string; title: string }[] = [];
    try {
      if (urlType === "playlist") {
        const playlistId = extractPlaylistId(videoUrl);
        if (!playlistId) return json({ error: "Could not extract playlist ID from URL." }, { status: 400 });
        videos = await getPlaylistVideos(playlistId, VIDEO_CAP);
      } else if (urlType === "channel") {
        const handle = extractChannelHandle(videoUrl);
        if (!handle) return json({ error: "Could not extract channel handle from URL." }, { status: 400 });
        videos = await getChannelVideos(handle, VIDEO_CAP);
      } else {
        // Single video — extract ID from URL
        const match = videoUrl.match(/(?:v=|youtu\.be\/)([^&\s]+)/);
        const id = match?.[1] ?? videoUrl;
        const title = await getVideoTitle(id);
        videos = [{ id, title }];
      }
    } catch (e: any) {
      return json({ error: e.message || "Failed to fetch video list from YouTube API." }, { status: 400 });
    }

    if (videos.length === 0) {
      return json({ error: "No videos found. Check the URL and try again." }, { status: 400 });
    }

    let imported = 0;
    let skipped = 0;

    for (const video of videos) {
      const canonicalUrl = `https://www.youtube.com/watch?v=${video.id}`;

      // Skip if already imported for this project
      const existing = await prisma.knowledgeSource.findFirst({
        where: { projectId: params.projectId!, source: canonicalUrl },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const transcript = await getYoutubeTranscript(canonicalUrl);
      if (!transcript) {
        skipped++;
        continue; // no captions, skip silently
      }

      await prisma.knowledgeSource.create({
        data: {
          projectId: params.projectId!,
          type: "youtube",
          source: canonicalUrl,
          title: video.title || `YouTube Video (${video.id})`,
          content: transcript,
        },
      });

      const chunks = chunkText(transcript);
      await upsertChunks(
        params.projectId!,
        chunks.map(c => ({ text: c, metadata: { title: video.title || "YouTube Video", source: canonicalUrl } }))
      );

      imported++;
    }

    const isMulti = urlType !== "video";
    const cappedNote = videos.length >= VIDEO_CAP
      ? ` (first ${VIDEO_CAP} videos — re-submit to import more)`
      : "";

    return json({
      success: true,
      message: isMulti
        ? `Imported ${imported} video transcript${imported !== 1 ? "s" : ""}, skipped ${skipped}${cappedNote}.`
        : imported > 0
          ? "YouTube transcript imported and indexed successfully."
          : "Could not fetch transcript. Make sure the video has captions enabled.",
    });
  }

  if (method === "upload_file") {
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return json({ error: "No file uploaded" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    let content = "";
    
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      content = await parsePdf(buffer);
    } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith(".docx")) {
      content = await parseDocx(buffer);
    } else if (file.type === "text/plain") {
      content = buffer.toString();
    } else if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      const { parseCsv } = await import("~/ai-layer/document-parsers.server");
      content = parseCsv(buffer);
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      file.name.endsWith(".pptx")
    ) {
      const { parsePptx } = await import("~/ai-layer/document-parsers.server");
      content = await parsePptx(buffer);
    } else if (
      file.type === "text/markdown" ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".markdown")
    ) {
      const { parseMarkdown } = await import("~/ai-layer/document-parsers.server");
      content = parseMarkdown(buffer);
    } else {
      return json({ error: "Unsupported file type. Use PDF, DOCX, TXT, CSV, PPTX or MD." }, { status: 400 });
    }

    if (!content.trim()) return json({ error: "Failed to extract text from file" }, { status: 400 });

    await prisma.knowledgeSource.create({
      data: {
        projectId: params.projectId!,
        type: "file",
        source: file.name,
        title: file.name,
        content: content,
      },
    });

    const chunks = chunkText(content);
    await upsertChunks(params.projectId!, chunks.map(c => ({ text: c, metadata: { title: file.name, source: 'file' } })));

    return json({ success: true, message: `File "${file.name}" uploaded and indexed successfully` });
  }

  if (method === "update_sync_schedule") {
    const frequency = formData.get("frequency") as string;
    const project = await prisma.project.findUnique({ where: { id: params.projectId } });
    const currentSettings = (project?.settings as any) || {};
    
    await prisma.project.update({
      where: { id: params.projectId },
      data: {
        settings: {
          ...currentSettings,
          syncFrequency: frequency
        }
      }
    });
    
    return json({ success: true, message: `Sync frequency updated to ${frequency}` });
  }

  if (method === "trigger_sync_now") {
    const { syncProjectSources } = await import("~/backend/sync-job.server");
    try {
      await syncProjectSources(params.projectId!);
      return json({ success: true, message: "On-demand sync successfully completed! All web pages and active integrations have been recrawled and updated." });
    } catch (err: any) {
      return json({ error: `On-demand sync failed: ${err.message}` }, { status: 500 });
    }
  }

  if (method === "sync_notion") {
    const { syncNotion } = await import("~/backend/integrations.server");
    await syncNotion(params.projectId!);
    return json({ success: true, message: "Notion pages synced successfully" });
  }

  if (method === "sync_google") {
    const { syncGoogleDrive } = await import("~/backend/integrations.server");
    await syncGoogleDrive(params.projectId!);
    return json({ success: true, message: "Google Drive files synced successfully" });
  }

  if (method === "get_sitemap") {
    const urls = await getSitemapUrls(url);
    return json({ sitemapUrls: urls });
  }

  if (method === "get_docs_sitemap") {
    const docsUrl = formData.get("docsUrl") as string;
    if (!docsUrl) return json({ error: "Enter a docs URL." }, { status: 400 });

    const { resolveDocsSitemapUrl, getSitemapUrls } = await import("~/ai-layer/crawler.server");
    const { sitemapUrl, type } = resolveDocsSitemapUrl(docsUrl);

    let urls: string[] = [];
    try {
      urls = await getSitemapUrls(sitemapUrl);
    } catch {
      return json({
        error: `Could not find a sitemap at ${sitemapUrl}. Make sure the URL is correct and the site has a sitemap.xml.`,
      }, { status: 400 });
    }

    if (urls.length === 0 && type === "gitbook") {
      try {
        const altSitemap = sitemapUrl.replace("sitemap.xml", "sitemap-0.xml");
        urls = await getSitemapUrls(altSitemap);
      } catch {
        // ignore, return the empty error below
      }
    }

    if (type === "zendesk") {
      const enUs = urls.filter(u => u.includes("/en-us/") || u.includes("/en/"));
      urls = enUs.length > 0 ? enUs : urls;
    }

    if (urls.length === 0) {
      return json({ error: `No pages found in the sitemap at ${sitemapUrl}.` }, { status: 400 });
    }

    return json({ sitemapUrls: urls, detectedType: type, sitemapUrl });
  }

  if (method === "crawl_sitemap_urls") {
    const urlsJson = formData.get("urls") as string;
    const urls = JSON.parse(urlsJson || "[]") as string[];

    if (urls.length === 0) {
      return json({ error: "No URLs found in this sitemap" }, { status: 400 });
    }

    const results = [];
    const maxToCrawl = Math.min(urls.length, 30); // Crawl up to 30 pages to prevent extreme timeouts
    const crawledUrls = urls.slice(0, maxToCrawl);

    for (const itemUrl of crawledUrls) {
      try {
        const data = await crawlUrl(itemUrl);
        if (data && data.content) {
          const content = data.content || "";
          const title = data.title || itemUrl;
          
          const existing = await prisma.knowledgeSource.findFirst({
            where: { projectId: params.projectId, source: itemUrl, type: "web" },
          });

          if (existing) {
            await prisma.knowledgeSource.update({
              where: { id: existing.id },
              data: { title, content },
            });
          } else {
            await prisma.knowledgeSource.create({
              data: {
                projectId: params.projectId!,
                type: "web",
                source: itemUrl,
                title,
                content,
              },
            });
          }

          const chunks = chunkText(content);
          await upsertChunks(params.projectId!, chunks.map(c => ({ text: c, metadata: { url: itemUrl, title } })));
          results.push(itemUrl);
         }
      } catch (err) {
        console.error(`Sitemap scrape failed for ${itemUrl}:`, err);
      }
    }

    return json({ 
      success: true, 
      message: `Successfully crawled and indexed ${results.length} pages from the sitemap!` 
    });
  }

  return json({});
}

export default function TrainProject() {
  const { project } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;
  const navigation = useNavigation();
  const isCrawling = navigation.state === "submitting";
  const [activeTab, setActiveTab] = useState<"web" | "text" | "youtube" | "files" | "qa">("web");
  const [qaSearch, setQaSearch] = useState("");
  const [qaPage, setQaPage] = useState(1);
  const [editingQa, setEditingQa] = useState<any | null>(null);
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");

  useEffect(() => {
    if (actionData?.success) {
      setEditingQa(null);
      setQaQuestion("");
      setQaAnswer("");
    }
  }, [actionData]);

  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (provider: 'notion' | 'google') => {
    setConnecting(provider);
    try {
      const resp = await fetch(`/api/auth/${provider}/url?projectId=${project.id}`);
      const { url } = await resp.json();
      if (url) {
        window.open(url, "oauth_popup", "width=600,height=700");
      }
    } catch (e) {
      console.error("Connect error:", e);
    } finally {
      setConnecting(null);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        // Refresh the page to show connected status
        window.location.reload();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const integrations = (project as any).integrations || [];
  const isNotionConnected = integrations.some((i: any) => i.provider === 'notion');
  const isDriveConnected = integrations.some((i: any) => i.provider === 'google_drive');

  return (
    <div>
      <Link to={`/dashboard/projects/${project.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-brand-gray transition-colors mb-6">
        <ChevronLeft className="w-4 h-4" /> Back to project
      </Link>
      
      <div className="mb-12">
        <h1 className="text-4xl font-black mb-2">Train Chatbot</h1>
        <p className="text-text-muted">Import content from various sources to teach your AI.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-1 bg-zinc-100 rounded-2xl w-fit mb-12">
        <button 
          onClick={() => setActiveTab("web")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'web' ? 'bg-white shadow-sm text-primary' : 'text-text-muted'}`}
        >
          <Globe className="w-4 h-4" /> Website
        </button>
        <button 
          onClick={() => setActiveTab("files")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'files' ? 'bg-white shadow-sm text-primary' : 'text-text-muted'}`}
        >
          <FileText className="w-4 h-4" /> Files
        </button>
        <button 
          onClick={() => setActiveTab("text")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'text' ? 'bg-white shadow-sm text-primary' : 'text-text-muted'}`}
        >
          <Type className="w-4 h-4" /> Direct Text
        </button>
        <button 
          onClick={() => setActiveTab("youtube")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'youtube' ? 'bg-white shadow-sm text-primary' : 'text-text-muted'}`}
        >
          <Video className="w-4 h-4" /> YouTube
        </button>
        <button 
          onClick={() => setActiveTab("qa")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'qa' ? 'bg-white shadow-sm text-primary' : 'text-text-muted'}`}
        >
          <HelpCircle className="w-4 h-4" /> Q&A
        </button>
        <button 
          onClick={() => setActiveTab("connect" as any)}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === ('connect' as any) ? 'bg-white shadow-sm text-brand-orange' : 'text-text-muted'}`}
        >
          <Zap className="w-4 h-4" /> Connect (Integrations)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="bg-white p-10 rounded-[40px] border border-zinc-100 h-fit">
          {activeTab === "web" && (
            <>
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <Globe className="text-primary w-6 h-6" /> Single Page
              </h2>
              
              <Form method="post" className="space-y-6">
                <input type="hidden" name="_action" value="crawl_single" />
                <div>
                  <label className="block text-sm font-bold mb-2">Page URL</label>
                  <input 
                    type="url" 
                    name="url" 
                    placeholder="https://example.com/docs"
                    required
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isCrawling}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isCrawling ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  Crawl & Train
                </button>
              </Form>
            </>
          )}

          {(activeTab as any) === "connect" && (
            <>
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <Zap className="text-brand-orange w-6 h-6 text-orange-500" /> Multi-Source Training
              </h2>
              
              <div className="space-y-4">
                <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 flex items-center justify-between group hover:border-black/10 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center font-black text-xl">N</div>
                    <div>
                      <h3 className="font-bold flex items-center gap-2">
                        Notion 
                        {isNotionConnected && <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full uppercase tracking-wider font-black">Connected</span>}
                      </h3>
                      <p className="text-xs text-text-muted">Import pages from your Notion workspace</p>
                    </div>
                  </div>
                  <Form method="post">
                    <input type="hidden" name="_action" value="sync_notion" />
                    {isNotionConnected ? (
                      <button 
                        type="submit"
                        disabled={isCrawling}
                        className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold transition-all hover:scale-105"
                      >
                        {isCrawling ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sync All"}
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => handleConnect('notion')}
                        disabled={!!connecting}
                        className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold transition-all hover:scale-105"
                      >
                        {connecting === 'notion' ? <Loader2 className="w-3 h-3 animate-spin" /> : "Connect"}
                      </button>
                    )}
                  </Form>
                </div>

                <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 flex items-center justify-between group hover:border-blue-500/10 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-6 h-6"><path fill="#4285F4" d="M12 2L4.5 15h15L12 2z"/><path fill="#34A853" d="M4.5 15l3.5 6h12l-3.5-6h-12z"/><path fill="#FBBC05" d="M12 2l3.5 6h-7L12 2z"/></svg>
                    </div>
                    <div>
                      <h3 className="font-bold flex items-center gap-2">
                        Google Drive
                        {isDriveConnected && <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full uppercase tracking-wider font-black">Connected</span>}
                      </h3>
                      <p className="text-xs text-text-muted">Train on docs, slides, and papers</p>
                    </div>
                  </div>
                  <Form method="post">
                    <input type="hidden" name="_action" value="sync_google" />
                    {isDriveConnected ? (
                      <button 
                        type="submit"
                        disabled={isCrawling}
                        className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold transition-all hover:scale-105"
                      >
                        {isCrawling ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sync All"}
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => handleConnect('google')}
                        disabled={!!connecting}
                        className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold transition-all hover:scale-105"
                      >
                        {connecting === 'google' ? <Loader2 className="w-3 h-3 animate-spin" /> : "Connect"}
                      </button>
                    )}
                  </Form>
                </div>

                <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 flex items-center justify-between group hover:border-purple-500/10 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                      <Globe className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="font-bold">Zendesk Help Center</h3>
                      <p className="text-xs text-text-muted">Sync your support articles</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:scale-105 transition-all">Connect</button>
                </div>
              </div>
            </>
          )}

          {activeTab === "files" && (
            <>
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <FileText className="text-primary w-6 h-6" /> Upload Files
              </h2>
              
              <Form method="post" encType="multipart/form-data" className="space-y-6">
                <input type="hidden" name="_action" value="upload_file" />
                <div className="border-2 border-dashed border-zinc-200 rounded-[32px] p-12 text-center hover:border-primary hover:bg-primary-muted/10 transition-all cursor-pointer group relative">
                  <input 
                    type="file" 
                    name="file" 
                    accept=".pdf,.docx,.txt,.csv,.pptx,.md,.markdown"
                    required
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-zinc-400 group-hover:text-primary" />
                  </div>
                  <h3 className="font-bold mb-1">Click or drag a file here</h3>
                  <p className="text-xs text-text-muted">Supports PDF, DOCX, TXT, CSV, PPTX, and Markdown (Max 10MB)</p>
                </div>
                <button 
                  type="submit" 
                  disabled={isCrawling}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isCrawling ? <Loader2 className="w-5 h-5 animate-spin" /> : "Upload & Train"}
                </button>
              </Form>
            </>
          )}

          {activeTab === "text" && (
            <>
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <Type className="text-primary w-6 h-6" /> Add Text Content
              </h2>
              
              <Form method="post" className="space-y-6">
                <input type="hidden" name="_action" value="add_text" />
                <div>
                  <label className="block text-sm font-bold mb-2">Title</label>
                  <input 
                    type="text" 
                    name="title" 
                    placeholder="E.g. Refund Policy"
                    required
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Content</label>
                  <textarea 
                    name="content" 
                    rows={10}
                    placeholder="Paste your text content here..."
                    required
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  ></textarea>
                </div>
                <button 
                  type="submit" 
                  disabled={isCrawling}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isCrawling ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save & Train"}
                </button>
              </Form>
            </>
          )}

          {activeTab === "youtube" && (
            <>
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <Video className="text-primary w-6 h-6" /> YouTube Video, Playlist, or Channel
              </h2>
              
              <Form method="post" className="space-y-6">
                <input type="hidden" name="_action" value="add_youtube" />
                <div>
                  <label className="block text-sm font-bold mb-2">YouTube URL</label>
                  <input 
                    type="url" 
                    name="url" 
                    placeholder="E.g., video URL, playlist URL, or channel URL"
                    required
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                  <div className="mt-3 text-xs text-zinc-400 space-y-1.5 font-medium leading-relaxed">
                    <p>
                      Supports single video URLs, playlists (with <code>?list=</code>), and channel URLs (with <code>/@handle</code>).
                    </p>
                    <p className="font-semibold text-zinc-500">
                      ⚠️ Note: Imports are capped at peak 20 transcript-enabled videos at a time to keep response times fast and stable.
                    </p>
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isCrawling}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isCrawling ? <Loader2 className="w-5 h-5 animate-spin" /> : "Import YouTube Data"}
                </button>
              </Form>
            </>
          )}

          {activeTab === "qa" && (
            <>
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <HelpCircle className="text-primary w-6 h-6" /> {editingQa ? "Edit Predefined Q&A" : "Add Predefined Q&A"}
              </h2>
              <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
                Provide preconfigured, high-quality answers to specific questions. Predefined Q&A matches will automatically override vector-based search.
              </p>
              
              <Form method="post" className="space-y-6">
                <input type="hidden" name="_action" value={editingQa ? "edit_qa" : "add_qa"} />
                {editingQa && <input type="hidden" name="id" value={editingQa.id} />}
                
                <div>
                  <label className="block text-sm font-bold mb-2">Question</label>
                  <input 
                    type="text" 
                    name="question" 
                    value={qaQuestion}
                    onChange={(e) => setQaQuestion(e.target.value)}
                    placeholder="E.g. What is your refund policy?"
                    required
                    maxLength={500}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-sm"
                  />
                  <span className="text-[10px] text-zinc-400 mt-1 block text-right">{qaQuestion.length}/500</span>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Answer</label>
                  <textarea 
                    name="answer" 
                    value={qaAnswer}
                    onChange={(e) => setQaAnswer(e.target.value)}
                    rows={8}
                    placeholder="E.g. We offer a 100% money-back guarantee within 14 days of purchase. No questions asked!"
                    required
                    maxLength={5000}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm leading-relaxed"
                  ></textarea>
                  <span className="text-[10px] text-zinc-400 mt-1 block text-right">{qaAnswer.length}/5000</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    type="submit" 
                    disabled={isCrawling}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isCrawling ? <Loader2 className="w-5 h-5 animate-spin" /> : editingQa ? "Update Entry" : "Create & Save"}
                  </button>
                  {editingQa && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingQa(null);
                        setQaQuestion("");
                        setQaAnswer("");
                      }}
                      className="px-6 py-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-2xl transition-all"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </Form>
            </>
          )}

          <div className="mt-6">
            {actionData?.success && <p className="text-green-500 font-bold text-center">{actionData.message}</p>}
            {actionData?.error && <p className="text-red-500 font-bold text-center">{actionData.error}</p>}
          </div>
        </div>

        {activeTab === "qa" && (
          <div className="bg-white p-10 rounded-[40px] border border-zinc-100 h-fit space-y-8">
            <div>
              <div className="flex items-center justify-between gap-4 mb-2">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <List className="text-primary w-6 h-6" /> Custom Answers ({((project as any).knowledgeQAs || []).length})
                </h2>
                <div className="text-[10px] font-black tracking-widest uppercase bg-zinc-100 text-zinc-500 px-3 py-1.5 rounded-lg border border-zinc-200/50">
                  Total Hits: {((project as any).knowledgeQAs || []).reduce((acc: number, cur: any) => acc + (cur.triggerCount || 0), 0)}
                </div>
              </div>
              <p className="text-xs text-zinc-400">Search, edit, or delete manual Q&A overrides designed for this chatbot.</p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search predefined questions..."
                value={qaSearch}
                onChange={(e) => {
                  setQaSearch(e.target.value);
                  setQaPage(1); // Reset page on search
                }}
                className="w-full pl-12 pr-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            </div>

            {/* List and Pagination */}
            {(() => {
              const allQAs = (project as any).knowledgeQAs || [];
              const filteredQAs = allQAs.filter((qa: any) => 
                qa.question.toLowerCase().includes(qaSearch.toLowerCase()) ||
                qa.answer.toLowerCase().includes(qaSearch.toLowerCase())
              );

              const itemsPerPage = 5;
              const totalPages = Math.ceil(filteredQAs.length / itemsPerPage);
              const currentPage = Math.min(qaPage, totalPages || 1);
              const indexOfLastItem = currentPage * itemsPerPage;
              const indexOfFirstItem = indexOfLastItem - itemsPerPage;
              const currentItems = filteredQAs.slice(indexOfFirstItem, indexOfLastItem);

              if (filteredQAs.length === 0) {
                return (
                  <div className="text-center py-12 border border-dashed border-zinc-200 rounded-3xl bg-zinc-50/50">
                    <div className="w-12 h-12 bg-white rounded-2xl border border-zinc-100 flex items-center justify-center mx-auto mb-4">
                      <HelpCircle className="w-6 h-6 text-zinc-400" />
                    </div>
                    <h3 className="font-bold text-zinc-700 text-sm mb-1">No Q&A matches found</h3>
                    <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                      {allQAs.length === 0 
                        ? "Create your very first manual predefined override answer in the left panel!"
                        : "Try adjusting your search terms to locate specific overrides."}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="divide-y divide-zinc-100">
                    {currentItems.map((qa: any) => (
                      <div key={qa.id} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-2 group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="font-extrabold text-sm text-zinc-900 leading-snug">
                              Q: {qa.question}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingQa(qa);
                                  setQaQuestion(qa.question);
                                  setQaAnswer(qa.answer);
                                }}
                                className="p-1.5 hover:bg-zinc-100 rounded-md text-zinc-400 hover:text-primary transition-colors"
                                title="Edit Question"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <Form method="post" className="inline-block">
                                <input type="hidden" name="_action" value="delete_qa" />
                                <input type="hidden" name="id" value={qa.id} />
                                <button
                                  type="submit"
                                  onClick={(e) => {
                                    if (!confirm("Are you sure you want to delete this custom answer?")) {
                                      e.preventDefault();
                                    }
                                  }}
                                  className="p-1.5 hover:bg-red-50 rounded-md text-zinc-400 hover:text-red-500 transition-colors"
                                  title="Delete Question"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </Form>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500 leading-relaxed bg-zinc-50/50 p-3 rounded-xl border border-zinc-100/50 my-2 whitespace-pre-wrap">
                            {qa.answer}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                            <span>Hits: {qa.triggerCount || 0}</span>
                            <span>•</span>
                            <span>Added: {new Date(qa.createdAt).toLocaleDateString()}</span>
                            {qa.lastUsedAt && (
                              <>
                                <span>•</span>
                                <span>Used: {new Date(qa.lastUsedAt).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-zinc-100 pt-4 text-xs font-bold text-zinc-500">
                      <span>Page {currentPage} of {totalPages}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => setQaPage(p => Math.max(1, p - 1))}
                          className="p-2 border border-zinc-100 hover:bg-zinc-50 disabled:opacity-50 rounded-lg transition-all"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={currentPage === totalPages}
                          onClick={() => setQaPage(p => Math.min(totalPages, p + 1))}
                          className="p-2 border border-zinc-100 hover:bg-zinc-50 disabled:opacity-50 rounded-lg transition-all"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === "web" && (
          <div className="space-y-8">
            <div className="bg-white p-10 rounded-[40px] border border-zinc-100 h-fit">
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <List className="text-primary w-6 h-6" /> Batch Crawl (Sitemap)
              </h2>
              
              <Form method="post" className="space-y-6">
                <input type="hidden" name="_action" value="get_sitemap" />
                <div>
                  <label className="block text-sm font-bold mb-2">Sitemap URL</label>
                  <input 
                    type="url" 
                    name="url" 
                    placeholder="https://example.com/sitemap.xml"
                    required
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isCrawling}
                  className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2"
                >
                  {isCrawling ? <Loader2 className="w-5 h-5 animate-spin" /> : "Fetch Sitemap URLs"}
                </button>
              </Form>

              {actionData?.sitemapUrls && actionData?.detectedType === undefined && (
                <div className="mt-8 space-y-4 border-t border-zinc-100 pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-sm text-zinc-800">Found {actionData.sitemapUrls.length} URLs</h3>
                      <p className="text-[11px] text-zinc-400">Click below to crawl up to 30 pages and train your chatbot.</p>
                    </div>
                    <Form method="post" className="shrink-0">
                      <input type="hidden" name="_action" value="crawl_sitemap_urls" />
                      <input type="hidden" name="urls" value={JSON.stringify(actionData.sitemapUrls)} />
                      <button 
                        type="submit" 
                        disabled={isCrawling}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-blue-500/15 cursor-pointer"
                      >
                        {isCrawling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Index All Sitemap URLs"}
                      </button>
                    </Form>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-2 border border-zinc-50 rounded-xl p-2 bg-zinc-50/20">
                    {actionData.sitemapUrls.map((url: string) => (
                      <div key={url} className="p-3 bg-white rounded-xl text-xs font-mono truncate border border-zinc-100 flex items-center justify-between gap-2 shadow-sm">
                        <span className="truncate text-zinc-600">{url}</span>
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none bg-blue-50 px-2 py-1 rounded">Pending</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Docs Site Import — Gitbook, Zendesk Help Center, or any docs site */}
            <div className="bg-white p-10 rounded-[40px] border border-zinc-100 h-fit">
              <Form method="post" className="space-y-6">
                <input type="hidden" name="_action" value="get_docs_sitemap" />

                <div className="flex items-center gap-3">
                  <BookOpen className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold">Import Documentation Site</h2>
                </div>
                <p className="text-xs text-zinc-400">
                  Paste a Gitbook, Zendesk Help Center, or any docs URL — SiteGist auto-detects and imports all pages.
                </p>

                <div>
                  <label className="block text-sm font-bold mb-2">Docs Site URL</label>
                  <input
                    type="url"
                    name="docsUrl"
                    required
                    placeholder="https://docs.myapp.gitbook.io or https://support.myapp.com/hc"
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-medium"
                  />
                </div>

                <button type="submit" disabled={isCrawling}
                  className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2">
                  {isCrawling ? <Loader2 className="w-5 h-5 animate-spin" /> : "Fetch Documentation Pages"}
                </button>
              </Form>

              {actionData?.sitemapUrls && actionData?.detectedType !== undefined && (
                <div className="mt-8 space-y-4 border-t border-zinc-100 pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-sm text-zinc-800 flex items-center gap-2 flex-wrap">
                        Found {actionData.sitemapUrls.length} URLs
                        {actionData.detectedType && actionData.detectedType !== "web" && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                            actionData.detectedType === "gitbook"
                              ? "bg-blue-50 text-blue-700 border-blue-100"
                              : "bg-green-50 text-green-700 border-green-100"
                          }`}>
                            {actionData.detectedType === "gitbook" ? "Gitbook detected" : "Zendesk Help Center detected"}
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-zinc-400">Click below to crawl up to 30 pages and train your chatbot.</p>
                    </div>
                    <Form method="post" className="shrink-0">
                      <input type="hidden" name="_action" value="crawl_sitemap_urls" />
                      <input type="hidden" name="urls" value={JSON.stringify(actionData.sitemapUrls)} />
                      <button 
                        type="submit" 
                        disabled={isCrawling}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-blue-500/15 cursor-pointer"
                      >
                        {isCrawling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Index All Sitemap URLs"}
                      </button>
                    </Form>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-2 border border-zinc-50 rounded-xl p-2 bg-zinc-50/20">
                    {actionData.sitemapUrls.map((url: string) => (
                      <div key={url} className="p-3 bg-white rounded-xl text-xs font-mono truncate border border-zinc-100 flex items-center justify-between gap-2 shadow-sm">
                        <span className="truncate text-zinc-600">{url}</span>
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none bg-blue-50 px-2 py-1 rounded">Pending</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sources List */}
      <div className="mt-12 bg-white rounded-[40px] border border-zinc-100 overflow-hidden shadow-sm">
        <div className="p-8 border-b border-zinc-50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Training Knowledge Base</h2>
            <p className="text-xs text-zinc-400 mt-1">Manage the data your AI uses to answer questions.</p>
          </div>
          <div className="flex items-center gap-3">
            <Form method="post">
              <input type="hidden" name="_action" value="trigger_sync_now" />
              <button
                type="submit"
                disabled={isCrawling}
                className="px-4 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isCrawling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Sync All
              </button>
            </Form>
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 px-3 py-1 rounded-lg border border-zinc-100">
              {(project as any).knowledgeSources.length} Sources
            </div>
          </div>
        </div>
        
        <div className="divide-y divide-zinc-50">
          {(project as any).knowledgeSources.map((source: any) => (
            <div key={source.id} className="p-6 flex items-center justify-between group hover:bg-zinc-50/50 transition-all">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                  source.type === 'web' ? 'bg-blue-50 text-blue-500 border-blue-100' :
                  source.type === 'file' ? 'bg-orange-50 text-orange-500 border-orange-100' :
                  'bg-zinc-50 text-zinc-500 border-zinc-100'
                }`}>
                  {source.type === 'web' ? <Globe className="w-6 h-6" /> : 
                   source.type === 'file' ? <FileText className="w-6 h-6" /> : <Type className="w-6 h-6" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-sm truncate max-w-sm">{source.title || source.source}</h4>
                    <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-[9px] font-black uppercase tracking-tighter border border-green-100">Trained</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-medium">
                    <span className="truncate max-w-[200px] font-mono">{source.source}</span>
                    <span className="flex items-center gap-1">• <Clock className="w-3 h-3" /> {new Date(source.updatedAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1">• <Database className="w-3 h-3" /> {source.content?.length || 0} chars</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  className="p-2.5 text-zinc-400 hover:text-primary hover:bg-zinc-100 rounded-xl transition-all"
                  title="Resync Source"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <Form method="post">
                  <input type="hidden" name="_action" value="delete_source" />
                  <input type="hidden" name="id" value={source.id} />
                  <button 
                    type="submit" 
                    className="p-2.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    title="Remove Source"
                    onClick={(e) => !confirm("Are you sure? This will remove the source from the training data.") && e.preventDefault()}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </Form>
              </div>
            </div>
          ))}
          {(project as any).knowledgeSources.length === 0 && (
            <div className="p-20 text-center text-zinc-400 italic flex flex-col items-center">
              <Database className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold text-zinc-300">No knowledge sources found.</p>
              <p className="text-xs">Add a website, doc, or PDF above to start training your bot.</p>
            </div>
          )}
        </div>
      </div>

      {/* Advanced RAG Strategy */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm">
           <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
              <Zap className="w-6 h-6" />
           </div>
           <h3 className="text-xl font-bold mb-2">Automated Refresh</h3>
           <p className="text-sm text-text-muted mb-6 font-medium">Keep your AI synced with your latest website content automatically.</p>
           <div className="space-y-4">
              <Form method="post" className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                 <input type="hidden" name="_action" value="update_sync_schedule" />
                 <div>
                    <h4 className="text-sm font-bold">Sync Frequency</h4>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Advanced Plan Required</p>
                 </div>
                 <select 
                   name="frequency" 
                   defaultValue={(project as any).settings?.syncFrequency || "Daily"}
                   onChange={(e) => e.currentTarget.form?.requestSubmit()}
                   className="bg-white border border-zinc-200 text-xs font-bold px-3 py-1.5 rounded-lg outline-none cursor-pointer"
                 >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Manual">Manual Only</option>
                 </select>
              </Form>
              
              <Form method="post">
                <input type="hidden" name="_action" value="trigger_sync_now" />
                <button 
                  type="submit"
                  disabled={isCrawling}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl text-sm font-black hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isCrawling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Trigger Manual Refresh Now"}
                </button>
              </Form>
           </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm">
           <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6">
              <Search className="w-6 h-6" />
           </div>
           <h3 className="text-xl font-bold mb-2">Retrieval Strategy</h3>
           <p className="text-sm text-text-muted mb-6 font-medium">Configure how the AI searches and re-ranks your knowledge.</p>
           <div className="space-y-3">
              {[
                { label: "Semantic Search (Vector)", status: "Active", color: "text-green-500" },
                { label: "Reranking (Cohere v3)", status: "Active", color: "text-blue-500" },
                { label: "Keyword Smoothing", status: "Active", color: "text-purple-500" },
              ].map((strategy, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-50 last:border-0">
                  <span className="text-sm font-bold text-zinc-600">{strategy.label}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${strategy.color}`}>{strategy.status}</span>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);
