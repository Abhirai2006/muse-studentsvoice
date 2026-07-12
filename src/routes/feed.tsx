import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SiteShell } from "@/components/SiteShell";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  uploadPostAttachments,
} from "@/lib/attachments";
import { X, Paperclip } from "lucide-react";
import {
  fetchPublicPosts,
  LOCATIONS,
  LOCATION_LABEL,
  type Location,
  ISSUE_TYPES,
  ISSUE_LABEL,
  type IssueType,
} from "@/lib/posts";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Complaint feed — MUSE Students Voice" },
      {
        name: "description",
        content:
          "Post a new complaint or vote on others. Signed-in feed for verified MUSE students with filters by location and issue type.",
      },
      { property: "og:title", content: "Complaint feed — MUSE Students Voice" },
      {
        property: "og:description",
        content:
          "Signed-in feed where MUSE students post complaints, vote True or False, and filter issues by location and type.",
      },
      { name: "twitter:title", content: "Complaint feed — MUSE Students Voice" },
      {
        name: "twitter:description",
        content:
          "Signed-in feed where MUSE students post complaints, vote True or False, and filter issues by location and type.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FeedPage,
});

const bodySchema = z
  .string()
  .trim()
  .min(10, "At least 10 characters")
  .max(4000, "Keep it under 4000 characters");

const MAX_POSTS_PER_DAY = 3;

// Rough duplicate detection using bigram Jaccard similarity on normalized text.
// Warns (does not block) when similarity crosses this threshold.
const DUPLICATE_WARN_THRESHOLD = 0.55;

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function bigrams(s: string) {
  const n = normalize(s);
  const set = new Set<string>();
  for (let i = 0; i < n.length - 1; i++) set.add(n.slice(i, i + 2));
  return set;
}
function similarity(a: string, b: string) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((x) => B.has(x) && inter++);
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function formatDuration(ms: number) {
  if (ms <= 0) return "0m";
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function FeedPage() {
  const { user, profile, loading } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [location, setLocation] = useState<Location | "">("");
  const [issueType, setIssueType] = useState<IssueType | "">("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "most_voted" | "trending">("newest");
  const [filterLoc, setFilterLoc] = useState<Location | "all">("all");
  const [filterIssue, setFilterIssue] = useState<IssueType | "all">("all");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["public_posts"],
    queryFn: () => fetchPublicPosts(),
    enabled: !loading,
  });

  // Recent own posts — used for the rate-limit cooldown display and duplicate warnings.
  const recentMine = useQuery({
    queryKey: ["my_recent_posts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
      const { data, error } = await supabase
        .from("my_posts")
        .select("id, body, created_at, location, issue_type")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const cooldown = useMemo(() => {
    const rows = (recentMine.data ?? []).filter(
      (r) => new Date(r.created_at as string).getTime() > now - 24 * 3600_000,
    );
    if (rows.length < MAX_POSTS_PER_DAY) return null;
    // Rate-limit resets when the oldest of the last N posts falls out of the 24h window.
    const oldest = rows.slice(-MAX_POSTS_PER_DAY)[0];
    const resetsAt = new Date(oldest.created_at as string).getTime() + 24 * 3600_000;
    return resetsAt > now ? resetsAt : null;
  }, [recentMine.data, now]);

  const postsRemaining = Math.max(
    0,
    MAX_POSTS_PER_DAY -
      (recentMine.data ?? []).filter(
        (r) => new Date(r.created_at as string).getTime() > now - 24 * 3600_000,
      ).length,
  );

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    const combined = [...files, ...picked].slice(0, MAX_ATTACHMENTS);
    for (const f of combined) {
      if (!ALLOWED_ATTACHMENT_TYPES.includes(f.type)) {
        toast.error(`"${f.name}" is not a supported image type.`);
        e.target.value = "";
        return;
      }
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`"${f.name}" is larger than 5 MB.`);
        e.target.value = "";
        return;
      }
    }
    setFiles(combined);
    e.target.value = "";
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  if (!loading && !user) {
    return (
      <SiteShell>
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm">You need to sign in to post or vote.</p>
          <Link to="/auth" className="mt-3 inline-block">
            <Button>Sign in</Button>
          </Link>
        </div>
      </SiteShell>
    );
  }
  if (!loading && user && !profile) {
    return (
      <SiteShell>
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm">Link a USN to your account first.</p>
          <Link to="/auth" className="mt-3 inline-block">
            <Button>Link USN</Button>
          </Link>
        </div>
      </SiteShell>
    );
  }

  async function submit() {
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    if (!location) {
      toast.error("Pick a location.");
      return;
    }
    if (!issueType) {
      toast.error("Pick an issue type.");
      return;
    }
    if (!user) return;
    if (cooldown) {
      toast.error(
        `You've posted ${MAX_POSTS_PER_DAY} complaints in the last 24 hours. Please wait ${formatDuration(
          cooldown - Date.now(),
        )} before posting again.`,
      );
      return;
    }

    // Duplicate warning — non-blocking. Compare against the user's own last 7 days
    // AND the current public feed for the same location + issue type.
    const myMatch = (recentMine.data ?? [])
      .map((r) => ({ ...r, sim: similarity(parsed.data, r.body as string) }))
      .filter((r) => r.sim >= DUPLICATE_WARN_THRESHOLD)
      .sort((a, b) => b.sim - a.sim)[0];
    const feedMatch = !myMatch
      ? (data ?? [])
          .filter(
            (p) =>
              p.location === location &&
              p.issue_type === issueType &&
              (p.status === "open" || p.status === "verified_true"),
          )
          .map((p) => ({ ...p, sim: similarity(parsed.data, p.body) }))
          .filter((p) => p.sim >= DUPLICATE_WARN_THRESHOLD)
          .sort((a, b) => b.sim - a.sim)[0]
      : undefined;
    const match = myMatch ?? feedMatch;
    if (match) {
      const pct = Math.round(match.sim * 100);
      const ok = window.confirm(
        `This looks ${pct}% similar to an existing complaint:\n\n"${(match.body as string).slice(
          0,
          160,
        )}${(match.body as string).length > 160 ? "…" : ""}"\n\nPosting duplicates makes it harder for others to vote. Post it anyway?`,
      );
      if (!ok) return;
    }

    setBusy(true);
    const { data: inserted, error } = await supabase
      .from("posts")
      .insert({
        author_id: user.id,
        body: parsed.data,
        location,
        issue_type: issueType,
        category: "other",
      })
      .select("id")
      .maybeSingle();
    setBusy(false);
    if (error) {
      if (/Daily limit/i.test(error.message)) {
        // Trigger rejected — refetch cooldown state so the banner updates.
        qc.invalidateQueries({ queryKey: ["my_recent_posts", user.id] });
        toast.error(
          `You've hit the limit of ${MAX_POSTS_PER_DAY} complaints per 24 hours. Please try again a little later.`,
        );
      } else {
        toast.error(error.message);
      }
      return;
    }
    // Upload attachments (if any) once the post row exists.
    if (files.length > 0 && inserted?.id) {
      try {
        await uploadPostAttachments(inserted.id, user.id, files);
      } catch (e) {
        toast.error(
          `Complaint posted, but image upload failed: ${(e as Error).message}`,
        );
      }
    }
    setBody("");
    setLocation("");
    setIssueType("");
    setFiles([]);
    toast.success("Complaint posted.");
    qc.invalidateQueries({ queryKey: ["public_posts"] });
    qc.invalidateQueries({ queryKey: ["my_recent_posts", user.id] });
    qc.invalidateQueries({ queryKey: ["my_posts", user.id] });
  }

  return (
    <SiteShell>
      <h1 className="mb-4 font-serif text-2xl font-semibold">Student complaint feed</h1>
      <Link
        to="/complaint-guide"
        className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 text-sm transition hover:border-primary/40 hover:from-primary/15"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className="text-lg">
            📝
          </span>
          <span>
            <span className="font-medium text-foreground">New here?</span>{" "}
            <span className="text-muted-foreground">
              Read the 5-step guide to writing a complaint that gets verified.
            </span>
          </span>
        </span>
        <span className="text-primary shrink-0">Read guide →</span>
      </Link>
      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">New complaint</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Posting as <span className="font-mono">{profile?.usn}</span> — your USN is never shown to
          other users.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Location *</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value as Location)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select location…</option>
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {LOCATION_LABEL[l]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Issue type *</label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as IssueType)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select issue type…</option>
              {ISSUE_TYPES.map((i) => (
                <option key={i} value={i}>
                  {ISSUE_LABEL[i]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe the issue clearly. Stick to facts."
          rows={5}
          className="mt-3"
          maxLength={4000}
        />
        <div className="mt-3">
          <label className="text-xs font-medium text-muted-foreground">
            Evidence images (optional) — up to {MAX_ATTACHMENTS}, 5 MB each
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_ATTACHMENT_TYPES.join(",")}
              multiple
              onChange={onPickFiles}
              className="hidden"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= MAX_ATTACHMENTS}
            >
              <Paperclip className="mr-1.5 h-3.5 w-3.5" />
              {files.length === 0 ? "Attach images" : "Add more"}
            </Button>
            {files.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-xs"
              >
                <span className="max-w-[160px] truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="rounded-full p-0.5 hover:bg-background"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
        {cooldown && (
          <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            You've posted {MAX_POSTS_PER_DAY} complaints in the last 24 hours. You can post again in{" "}
            <span className="font-medium">{formatDuration(cooldown - now)}</span>.
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {body.length}/4000 · {postsRemaining} of {MAX_POSTS_PER_DAY} posts left today
          </span>
          <Button onClick={submit} disabled={busy || !!cooldown}>
            {busy ? "Posting…" : "Post complaint"}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Not sure how to phrase it? See{" "}
          <Link
            to="/complaint-guide"
            className="underline underline-offset-2 hover:text-foreground"
          >
            how to write an effective complaint
          </Link>
          .
        </p>
      </section>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="grow">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find by keyword…"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Location</label>
          <select
            value={filterLoc}
            onChange={(e) => setFilterLoc(e.target.value as Location | "all")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-44"
          >
            <option value="all">All locations</option>
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {LOCATION_LABEL[l]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Issue type</label>
          <select
            value={filterIssue}
            onChange={(e) => setFilterIssue(e.target.value as IssueType | "all")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-44"
          >
            <option value="all">All issues</option>
            {ISSUE_TYPES.map((i) => (
              <option key={i} value={i}>
                {ISSUE_LABEL[i]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Sort</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-44"
          >
            <option value="newest">Newest</option>
            <option value="most_voted">Most voted</option>
            <option value="trending">Trending (24h)</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        (() => {
          const q = search.trim().toLowerCase();
          let list = (data ?? []).filter(
            (p) =>
              (filterLoc === "all" || p.location === filterLoc) &&
              (filterIssue === "all" || p.issue_type === filterIssue) &&
              (q === "" || p.body.toLowerCase().includes(q)),
          );
          if (sort === "most_voted") {
            list = [...list].sort(
              (a, b) => b.true_count + b.false_count - (a.true_count + a.false_count),
            );
          } else if (sort === "trending") {
            const cutoff = Date.now() - 24 * 60 * 60 * 1000;
            list = [...list].sort((a, b) => {
              const ta =
                new Date(a.created_at).getTime() > cutoff
                  ? (a.true_count + a.false_count) * 2
                  : a.true_count + a.false_count;
              const tb =
                new Date(b.created_at).getTime() > cutoff
                  ? (b.true_count + b.false_count) * 2
                  : b.true_count + b.false_count;
              return tb - ta;
            });
          }
          if (list.length === 0) {
            return <p className="text-sm text-muted-foreground">No matching complaints.</p>;
          }
          return (
            <div className="space-y-3">
              {list.map((p) => (
                <PostCard key={p.id} post={p} compact />
              ))}
            </div>
          );
        })()
      )}
    </SiteShell>
  );
}
