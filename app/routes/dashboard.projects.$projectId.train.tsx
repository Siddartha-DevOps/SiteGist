import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData, useRevalidator, useSearchParams } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { getSitemapUrls } from "~/ai-layer/crawler.server";
import { enqueueSourceIngestion, enqueueManySourceIngestions } from "~/ai-layer/ingestion.server";
import { Globe, Search, Loader2, List, ChevronLeft, Type, Video, FileText, Upload, Zap, RefreshCw, Clock, Database, HelpCircle, Plus, Edit, Trash2, ArrowLeft, ArrowRight, BookOpen, Github } from "lucide-react";
import { Link } from "@remix-run/react";
import { useState, useEffect } from "react";
import { parsePdf, parseDocx } from "~/ai-layer/crawler.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  try {
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
  } catch (error: any) {
    // See the project-detail loader: surface real DB errors (schema drift, etc.)
    // via the root ErrorBoundary instead of the opaque scrubbed 500.
    if (error instanceof Response) throw error;
    console.error("[Train] loader DB error:", error?.message);
    throw json(
      { dbError: true, message: error?.message || "Failed to load training data from the database." },
      { status: 503 }
    );
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);

  // Tenant isolation: confirm the caller owns this project before any branch
  // runs. requireUserId only proves the caller is authenticated; without this
  // gate any logged-in user could train/delete sources on another tenant's
  // chatbot by POSTing to /dashboard/projects/<any-id>/train (IDOR).
  const accessible = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
    select: { id: true },
  });
  if (!accessible) throw redirect("/dashboard");

  // Safety net: any unhandled error in the branches below is returned as a
  // friendly inline message instead of crashing to the generic 500 error page.
  try {
  // Native FormData parsing handles both urlencoded forms and multipart/form-data
  // file uploads (returning File objects). The previous unstable_parseMultipartFormData
  // helper threw "Could not parse content as FormData" on the Node serverless runtime.
  const formData = await request.formData();
  
  const url = formData.get("url") as string;
  const method = formData.get("_action");

  if (method === "delete_source") {
    const sourceId = formData.get("id") as string;
    const source = await prisma.knowledgeSource.findFirst({ where: { id: sourceId, projectId: params.projectId! } });
    if (source) {
      const { deleteSourceChunks } = await import("~/ai-layer/ai.server");
      await deleteSourceChunks(params.projectId!, source.type === 'web' ? source.source : source.title || source.source);
      await prisma.knowledgeSource.delete({ where: { id: sourceId } });
    }
    return json({ success: true, message: "Source removed and vector data cleaned successfully" });
  }

  if (method === "retry_source") {
    const sourceId = formData.get("id") as string;
    const source = await prisma.knowledgeSource.findFirst({
      where: { id: sourceId, projectId: params.projectId! },
    });
    if (!source) return json({ error: "Source not found." }, { status: 404 });
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: "queued", error: null, chunksIndexed: 0 },
    });
    await enqueueSourceIngestion(params.projectId!, sourceId);
    return json({ success: true, message: "Re-queued for training." });
  }

  if (method === "set_recrawl") {
    const sourceId = formData.get("id") as string;
    const intervalRaw = (formData.get("interval") as string || "").trim();

    // Allowed cadences: never (null), monthly (30), weekly (7), daily (1).
    const ALLOWED = [1, 7, 30];
    let interval: number | null = null;
    if (intervalRaw && intervalRaw !== "null") {
      const parsed = parseInt(intervalRaw, 10);
      if (!ALLOWED.includes(parsed)) {
        return json({ error: "Invalid auto-refresh interval." }, { status: 400 });
      }
      interval = parsed;
    }

    const source = await prisma.knowledgeSource.findFirst({
      where: { id: sourceId, projectId: params.projectId! },
    });
    if (!source) return json({ error: "Source not found." }, { status: 404 });
    if (source.type !== "web" && source.type !== "youtube") {
      return json({ error: "Auto-refresh is only available for web and YouTube sources." }, { status: 400 });
    }

    const nextRecrawlAt = interval ? new Date(Date.now() + interval * 24 * 60 * 60 * 1000) : null;
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { recrawlIntervalDays: interval, nextRecrawlAt },
    });

    return json({
      success: true,
      message: interval
        ? `Auto-refresh set. Next refresh ${nextRecrawlAt!.toLocaleDateString()}.`
        : "Auto-refresh turned off for this source.",
    });
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

    await prisma.knowledgeQA.updateMany({
      where: { id, projectId: params.projectId! },
      data: { question, answer }
    });

    return json({ success: true, message: "Manual Q&A entry updated successfully!" });
  }

  if (method === "delete_qa") {
    const id = formData.get("id") as string;
    if (!id) return json({ error: "Missing Q&A entry ID." }, { status: 400 });

    await prisma.knowledgeQA.deleteMany({
      where: { id, projectId: params.projectId! }
    });

    return json({ success: true, message: "Manual Q&A entry deleted successfully!" });
  }

  if (!url && method !== "add_text" && method !== "upload_file" && method !== "bulk_import") {
    return json({ error: "URL is required" }, { status: 400 });
  }

  if (method === "crawl_single") {
    // Create/refresh the source row and hand off to the async ingestion pipeline.
    // The crawl + embed now happen in a durable background workflow (or inline as
    // a fallback when Inngest is not configured), so this request returns instantly.
    const existing = await prisma.knowledgeSource.findFirst({
      where: { projectId: params.projectId, source: url, type: "web" },
    });
    const src = existing
      ? await prisma.knowledgeSource.update({
          where: { id: existing.id },
          data: { status: "queued", error: null },
        })
      : await prisma.knowledgeSource.create({
          data: { projectId: params.projectId!, type: "web", source: url, title: url, status: "queued" },
        });

    await enqueueSourceIngestion(params.projectId!, src.id);
    return json({ success: true, message: "Page queued for training. It will show as Trained once indexing finishes." });
  }

  if (method === "add_text") {
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;

    const src = await prisma.knowledgeSource.create({
      data: { projectId: params.projectId!, type: "text", source: title, title, content, status: "queued" },
    });

    await enqueueSourceIngestion(params.projectId!, src.id);
    return json({ success: true, message: "Text content added and queued for training." });
  }

  if (method === "add_github") {
    const repoInput = (formData.get("repoUrl") as string || "").trim();
    const branchInput = (formData.get("branch") as string || "").trim() || undefined;
    const { parseGithubRepo, getGithubDocFiles } = await import("~/ai-layer/crawler.server");
    const parsed = parseGithubRepo(repoInput);
    if (!parsed) {
      return json({ error: "Enter a GitHub repo URL (https://github.com/owner/repo) or owner/repo." }, { status: 400 });
    }
    let files: { path: string; rawUrl: string }[] = [];
    try {
      const result = await getGithubDocFiles(parsed.owner, parsed.repo, branchInput);
      files = result.files;
    } catch (e: any) {
      return json({ error: e?.message || "Could not read that GitHub repo." }, { status: 400 });
    }
    if (files.length === 0) {
      return json({ error: "No markdown/docs files (.md, .mdx, .rst, .txt) found in that repo." }, { status: 400 });
    }

    const cap = Math.min(files.length, 300);
    const toEnqueue: { projectId: string; sourceId: string }[] = [];
    for (const f of files.slice(0, cap)) {
      const existing = await prisma.knowledgeSource.findFirst({
        where: { projectId: params.projectId, source: f.rawUrl, type: "github" },
      });
      const src = existing
        ? await prisma.knowledgeSource.update({ where: { id: existing.id }, data: { status: "queued", error: null } })
        : await prisma.knowledgeSource.create({
            data: {
              projectId: params.projectId!,
              type: "github",
              source: f.rawUrl,
              title: `${parsed.owner}/${parsed.repo}: ${f.path}`,
              status: "queued",
            },
          });
      toEnqueue.push({ projectId: params.projectId!, sourceId: src.id });
    }

    await enqueueManySourceIngestions(toEnqueue, { maxInline: 3 });
    const note = files.length > cap ? ` (first ${cap} of ${files.length})` : "";
    return json({
      success: true,
      message: `Queued ${toEnqueue.length} file${toEnqueue.length !== 1 ? "s" : ""} from ${parsed.owner}/${parsed.repo}${note}. They'll show as Trained as they finish.`,
    });
  }

  if (method === "add_youtube") {
    const videoUrl = formData.get("url") as string;
    const {
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

    // Create queued source rows and fan out to the ingestion pipeline. Transcripts
    // are fetched in the background; videos without captions are marked failed there.
    let queued = 0;
    let skipped = 0;
    const toEnqueue: { projectId: string; sourceId: string }[] = [];

    for (const video of videos) {
      const canonicalUrl = `https://www.youtube.com/watch?v=${video.id}`;
      const existing = await prisma.knowledgeSource.findFirst({
        where: { projectId: params.projectId!, source: canonicalUrl },
      });
      if (existing) {
        skipped++;
        continue;
      }
      const src = await prisma.knowledgeSource.create({
        data: {
          projectId: params.projectId!,
          type: "youtube",
          source: canonicalUrl,
          title: video.title || `YouTube Video (${video.id})`,
          status: "queued",
        },
      });
      toEnqueue.push({ projectId: params.projectId!, sourceId: src.id });
      queued++;
    }

    await enqueueManySourceIngestions(toEnqueue, { maxInline: 3 });

    const isMulti = urlType !== "video";
    const cappedNote = videos.length >= VIDEO_CAP
      ? ` (first ${VIDEO_CAP} videos — re-submit to import more)`
      : "";

    return json({
      success: true,
      message: isMulti
        ? `Queued ${queued} video${queued !== 1 ? "s" : ""} for training, skipped ${skipped} already-added${cappedNote}.`
        : queued > 0
          ? "YouTube video queued for training."
          : "This video is already in your knowledge base.",
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

    // Text is extracted here (the File can't cross the queue boundary); embedding
    // is handed off to the ingestion pipeline.
    const src = await prisma.knowledgeSource.create({
      data: {
        projectId: params.projectId!,
        type: "file",
        source: file.name,
        title: file.name,
        content: content,
        status: "queued",
      },
    });

    await enqueueSourceIngestion(params.projectId!, src.id);
    return json({ success: true, message: `File "${file.name}" uploaded and queued for training.` });
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

    // Drain handles the rest in the background; process a few inline for instant
    // feedback so the user sees progress immediately on click.
    const maxToQueue = Math.min(urls.length, 1000);
    const targetUrls = urls.slice(0, maxToQueue);

    const toEnqueue: { projectId: string; sourceId: string }[] = [];
    for (const itemUrl of targetUrls) {
      const existing = await prisma.knowledgeSource.findFirst({
        where: { projectId: params.projectId, source: itemUrl, type: "web" },
      });
      const src = existing
        ? await prisma.knowledgeSource.update({
            where: { id: existing.id },
            data: { status: "queued", error: null },
          })
        : await prisma.knowledgeSource.create({
            data: { projectId: params.projectId!, type: "web", source: itemUrl, title: itemUrl, status: "queued" },
          });
      toEnqueue.push({ projectId: params.projectId!, sourceId: src.id });
    }

    await enqueueManySourceIngestions(toEnqueue, { maxInline: 3 });

    const cappedNote = urls.length > maxToQueue ? ` (first ${maxToQueue} of ${urls.length})` : "";
    return json({
      success: true,
      message: `Queued ${toEnqueue.length} page${toEnqueue.length !== 1 ? "s" : ""} from the sitemap for training${cappedNote}. They'll show as Trained as they finish.`,
    });
  }

  if (method === "bulk_import") {
    const BULK_URL_CAP = 100;
    const raw = (formData.get("bulkUrls") as string) || "";

    const isValidHttpUrl = (value: string): boolean => {
      try {
        const u = new URL(value);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    };

    // 1. Split by newlines, trim, drop blanks, and de-duplicate the input lines.
    const lines = Array.from(
      new Set(
        raw
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
      )
    );

    if (lines.length === 0) {
      return json({ error: "Paste at least one URL (or a sitemap URL) to import." }, { status: 400 });
    }

    // 2. Expand sitemap URLs into their child <loc> URLs (reusing getSitemapUrls,
    //    which parses the sitemap.xml); keep plain page URLs as-is.
    const collected: string[] = [];
    let invalidCount = 0;
    let sitemapCount = 0;

    for (const line of lines) {
      if (!isValidHttpUrl(line)) {
        invalidCount++;
        continue;
      }
      if (line.toLowerCase().endsWith("sitemap.xml")) {
        sitemapCount++;
        const childUrls = await getSitemapUrls(line);
        for (const child of childUrls) {
          if (isValidHttpUrl(child)) collected.push(child);
        }
      } else {
        collected.push(line);
      }
    }

    // De-duplicate the final URL set and enforce the per-import cap.
    const uniqueUrls = Array.from(new Set(collected));
    const cappedUrls = uniqueUrls.slice(0, BULK_URL_CAP);

    if (cappedUrls.length === 0) {
      return json({
        error: invalidCount > 0
          ? "No valid http/https URLs found. Check the URLs and try again."
          : "No URLs found to import.",
      }, { status: 400 });
    }

    // 3 + 4. Create (or re-queue) a web KnowledgeSource per URL, then fan out to
    //        the ingestion pipeline. Mirrors the sitemap crawl flow above.
    const toEnqueue: { projectId: string; sourceId: string }[] = [];
    for (const itemUrl of cappedUrls) {
      const existing = await prisma.knowledgeSource.findFirst({
        where: { projectId: params.projectId, source: itemUrl, type: "web" },
      });
      const src = existing
        ? await prisma.knowledgeSource.update({
            where: { id: existing.id },
            data: { status: "queued", error: null },
          })
        : await prisma.knowledgeSource.create({
            data: { projectId: params.projectId!, type: "web", source: itemUrl, title: itemUrl, status: "queued" },
          });
      toEnqueue.push({ projectId: params.projectId!, sourceId: src.id });
    }

    await enqueueManySourceIngestions(toEnqueue, { maxInline: 3 });

    // 5. Report how many were queued, plus notes about caps/skips.
    const queuedCount = toEnqueue.length;
    const notes: string[] = [];
    if (uniqueUrls.length > cappedUrls.length) {
      notes.push(`capped at ${BULK_URL_CAP} (${uniqueUrls.length} found)`);
    }
    if (sitemapCount > 0) {
      notes.push(`expanded ${sitemapCount} sitemap${sitemapCount !== 1 ? "s" : ""}`);
    }
    if (invalidCount > 0) {
      notes.push(`skipped ${invalidCount} invalid line${invalidCount !== 1 ? "s" : ""}`);
    }
    const noteSuffix = notes.length > 0 ? ` (${notes.join(", ")})` : "";

    return json({
      success: true,
      queuedCount,
      message: `${queuedCount} source${queuedCount !== 1 ? "s" : ""} queued for training${noteSuffix}.`,
    });
  }

  return json({});
  } catch (error: any) {
    // Preserve Remix redirects / thrown Responses (e.g. auth) — only handle real errors.
    if (error instanceof Response) throw error;
    console.error("[Train Action] Unhandled error:", error);
    return json(
      {
        error: error?.message
          ? `Something went wrong: ${error.message}`
          : "An unexpected error occurred. Please try again.",
      },
      { status: 400 }
    );
  }
}

export default function TrainProject() {
  const { project } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;
  const navigation = useNavigation();
  const isCrawling = navigation.state === "submitting";
  const [searchParams, setSearchParams] = useSearchParams();
  type TrainTab = "web" | "bulk" | "text" | "youtube" | "files" | "qa";
  const tabParam = searchParams.get("tab") as TrainTab | null;
  const validTabs: TrainTab[] = ["web", "bulk", "text", "youtube", "files", "qa"];
  const initialTab: TrainTab = tabParam && validTabs.includes(tabParam) ? tabParam : "web";
  const [activeTab, setActiveTab] = useState<TrainTab>(initialTab);

  // Keep the active tab in sync when the sidebar deep-links (?tab=...).
  useEffect(() => {
    if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);
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

  // Poll the loader while any source is still being ingested so the status badges
  // update live (queued → processing → indexed/failed) without a manual refresh.
  const revalidator = useRevalidator();
  const sources = ((project as any).knowledgeSources || []);
  const sourcesInFlight = sources.some(
    (s: any) => ["queued", "processing", "crawling", "embedding"].includes(s.status)
  );
  const hasQueued = sources.some((s: any) => s.status === "queued");
  useEffect(() => {
    if (!sourcesInFlight) return;
    const t = setInterval(async () => {
      // Drain a few queued pages per tick so large sitemap crawls finish without
      // ever blocking a single request, then refresh the status badges.
      if (hasQueued) {
        try {
          await fetch("/api/ingest/drain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: project.id }),
          });
        } catch { /* transient; next tick retries */ }
      }
      if (revalidator.state === "idle") revalidator.revalidate();
    }, 4000);
    return () => clearInterval(t);
  }, [sourcesInFlight, hasQueued, revalidator, project.id]);

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
          onClick={() => setActiveTab("bulk")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'bulk' ? 'bg-white shadow-sm text-primary' : 'text-text-muted'}`}
        >
          <List className="w-4 h-4" /> Bulk Import
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

              <div className="mt-10 pt-8 border-t border-zinc-100">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                  <Github className="text-primary w-6 h-6" /> GitHub Repo
                </h2>
                <p className="text-sm text-text-muted mb-6">
                  Train on a public repo's docs — every Markdown / .rst / .txt file is imported automatically.
                </p>
                <Form method="post" className="space-y-6">
                  <input type="hidden" name="_action" value="add_github" />
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold mb-2">Repository</label>
                      <input
                        type="text"
                        name="repoUrl"
                        placeholder="https://github.com/owner/repo"
                        required
                        className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">Branch <span className="text-text-muted font-normal">(optional)</span></label>
                      <input
                        type="text"
                        name="branch"
                        placeholder="main"
                        className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isCrawling}
                    className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-black shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isCrawling ? <Loader2 className="w-5 h-5 animate-spin" /> : <Github className="w-5 h-5" />}
                    Import Repo Docs
                  </button>
                </Form>
              </div>
            </>
          )}

          {activeTab === "bulk" && (
            <>
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <List className="text-primary w-6 h-6" /> Bulk Import
              </h2>
              <p className="text-sm text-text-muted mb-8 leading-relaxed">
                Paste up to 100 page URLs (one per line) or a sitemap URL — every page is queued for training in one click.
              </p>

              <Form method="post" className="space-y-6">
                <input type="hidden" name="_action" value="bulk_import" />
                <div>
                  <label className="block text-sm font-bold mb-2">URLs</label>
                  <textarea
                    name="bulkUrls"
                    rows={10}
                    required
                    placeholder={"Paste one URL per line, or enter a sitemap URL\n\nhttps://example.com/about\nhttps://example.com/pricing\nhttps://example.com/sitemap.xml"}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-mono leading-relaxed"
                  ></textarea>
                  <p className="mt-2 text-xs text-zinc-400 font-medium leading-relaxed">
                    Lines ending in <code>sitemap.xml</code> are expanded into all their pages. Up to 100 URLs are queued per import.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isCrawling}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isCrawling ? <Loader2 className="w-5 h-5 animate-spin" /> : <List className="w-5 h-5" />}
                  Import All
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
                   source.type === 'file' ? <FileText className="w-6 h-6" /> :
                   source.type === 'github' ? <Github className="w-6 h-6" /> : <Type className="w-6 h-6" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-sm truncate max-w-sm">{source.title || source.source}</h4>
                    <SourceStatusBadge status={source.status} error={source.error} />
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-medium">
                    <span className="truncate max-w-[200px] font-mono">{source.source}</span>
                    <span className="flex items-center gap-1">• <Clock className="w-3 h-3" /> {new Date(source.updatedAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1">• <Database className="w-3 h-3" /> {source.content?.length || 0} chars</span>
                  </div>
                  {source.status === "embedding" && source.chunksTotal > 0 && (
                    <div className="mt-2 w-56 max-w-full">
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${Math.min(100, Math.round((source.chunksIndexed / source.chunksTotal) * 100))}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400 font-medium">{source.chunksIndexed}/{source.chunksTotal} chunks embedded</span>
                    </div>
                  )}
                  {source.status === "failed" && source.error && (
                    <p className="mt-1.5 text-[10px] text-red-500 font-medium max-w-md truncate" title={source.error}>⚠ {source.error}</p>
                  )}
                  {source.recrawlIntervalDays && source.nextRecrawlAt && (
                    <p className="mt-1.5 text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Next refresh: {new Date(source.nextRecrawlAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(source.type === "web" || source.type === "youtube") && (
                  <Form method="post">
                    <input type="hidden" name="_action" value="set_recrawl" />
                    <input type="hidden" name="id" value={source.id} />
                    <select
                      name="interval"
                      defaultValue={source.recrawlIntervalDays ? String(source.recrawlIntervalDays) : "null"}
                      onChange={(e) => e.currentTarget.form?.requestSubmit()}
                      title="Auto-refresh schedule"
                      className="bg-white border border-zinc-200 text-[11px] font-bold px-2.5 py-1.5 rounded-lg outline-none cursor-pointer text-zinc-600 hover:border-zinc-300 transition-colors"
                    >
                      <option value="null">Auto-refresh: Never</option>
                      <option value="30">Monthly</option>
                      <option value="7">Weekly</option>
                      <option value="1">Daily</option>
                    </select>
                  </Form>
                )}
                <Form method="post">
                  <input type="hidden" name="_action" value="retry_source" />
                  <input type="hidden" name="id" value={source.id} />
                  <button
                    type="submit"
                    disabled={["queued", "crawling", "embedding"].includes(source.status)}
                    className={`p-2.5 rounded-xl transition-all disabled:opacity-40 ${
                      source.status === "failed"
                        ? "text-red-500 hover:bg-red-50"
                        : "text-zinc-400 hover:text-primary hover:bg-zinc-100"
                    }`}
                    title={source.status === "failed" ? "Retry training" : "Resync / retrain"}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </Form>
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

function SourceStatusBadge({ status, error }: { status?: string; error?: string | null }) {
  const base = "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border inline-flex items-center gap-1";
  switch (status) {
    case "queued":
      return <span className={`${base} bg-amber-50 text-amber-600 border-amber-100`}>Queued</span>;
    case "crawling":
      return (
        <span className={`${base} bg-indigo-50 text-indigo-600 border-indigo-100`}>
          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Fetching
        </span>
      );
    case "processing":
    case "embedding":
      return (
        <span className={`${base} bg-blue-50 text-blue-600 border-blue-100`}>
          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Training
        </span>
      );
    case "failed":
      return (
        <span className={`${base} bg-red-50 text-red-600 border-red-100`} title={error || "Ingestion failed"}>
          Failed
        </span>
      );
    case "indexed":
    default:
      return <span className={`${base} bg-green-50 text-green-600 border-green-100`}>Trained</span>;
  }
}
