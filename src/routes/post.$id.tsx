import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ShieldCheck, ThumbsUp, ThumbsDown, Clock, Trash2, Pencil, Flag } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchPublicPost,
  fetchComments,
  fetchMyVote,
  castVote,
  clearVote,
  flagPost,
  fetchMyFlag,
  QUORUM,
  THRESHOLD_PCT,
  LOCATION_LABEL,
  ISSUE_LABEL,
  type Location,
  type IssueType,
} from "@/lib/posts";

export const Route = createFileRoute("/post/$id")({
  loader: async ({ params }) => {
    const post = await fetchPublicPost(params.id).catch(() => null);
    return { post };
  },
  head: ({ params, loaderData }) => {
    const post = loaderData?.post ?? null;
    const shortId = params.id.slice(0, 6);
    const snippet = post?.body
      ? post.body.replace(/\s+/g, " ").trim().slice(0, 155)
      : "An anonymous MUSE student complaint with peer voting, discussion, and verification status.";
    const title = post
      ? `${snippet.slice(0, 60)}${snippet.length > 60 ? "…" : ""} — MUSE Students Voice`
      : `Complaint #${shortId} — MUSE Students Voice`;
    const url = `https://muse-studentsvoice.lovable.app/post/${params.id}`;
    const scripts = post
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "DiscussionForumPosting",
              headline: `Complaint #${shortId}`,
              articleBody: post.body,
              datePublished: post.created_at,
              dateModified: post.updated_at ?? post.created_at,
              url,
              author: { "@type": "Person", name: "Anonymous MUSE student" },
              interactionStatistic: [
                {
                  "@type": "InteractionCounter",
                  interactionType: "https://schema.org/LikeAction",
                  userInteractionCount: post.true_count,
                },
                {
                  "@type": "InteractionCounter",
                  interactionType: "https://schema.org/CommentAction",
                  userInteractionCount: post.comment_count,
                },
              ],
            })
              .replace(/</g, "\\u003c")
              .replace(/>/g, "\\u003e")
              .replace(/&/g, "\\u0026")
              .replace(/\u2028/g, "\\u2028")
              .replace(/\u2029/g, "\\u2029"),
          },
        ]
      : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: snippet },
        { property: "og:title", content: title },
        { property: "og:description", content: snippet },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: snippet },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  component: PostDetailPage,
});

function PostDetailPage() {
  const { id } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const post = useQuery({ queryKey: ["post", id], queryFn: () => fetchPublicPost(id) });
  const comments = useQuery({ queryKey: ["comments", id], queryFn: () => fetchComments(id) });
  const myVote = useQuery({
    queryKey: ["myvote", id, user?.id],
    queryFn: () => fetchMyVote(id, user!.id),
    enabled: !!user,
  });
  // Detect ownership without exposing author_id to the public view: query the
  // raw `posts` table for matching id+author_id; RLS only returns a row when
  // the caller is the author.
  const owns = useQuery({
    queryKey: ["owns", id, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("posts")
        .select("id")
        .eq("id", id)
        .eq("author_id", user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });
  const myFlag = useQuery({
    queryKey: ["myflag", id, user?.id],
    queryFn: () => fetchMyFlag(id, user!.id),
    enabled: !!user,
  });

  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState("");

  if (post.isLoading)
    return (
      <SiteShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </SiteShell>
    );
  if (!post.data)
    return (
      <SiteShell>
        <p>Not found.</p>
      </SiteShell>
    );

  const p = post.data;
  const total = p.true_count + p.false_count;
  const truePct = total > 0 ? Math.round((p.true_count / total) * 100) : 0;
  const falsePct = total > 0 ? 100 - truePct : 0;
  const needed = Math.max(0, QUORUM - total);
  const locked = p.status === "verified_true";

  async function vote(value: boolean) {
    if (!user || !profile) {
      toast.error("Sign in with your USN to vote.");
      return;
    }
    try {
      if (myVote.data === value) {
        await clearVote(id, user.id);
      } else {
        await castVote(id, user.id, value);
      }
      qc.invalidateQueries({ queryKey: ["myvote", id, user.id] });
      qc.invalidateQueries({ queryKey: ["post", id] });
      qc.invalidateQueries({ queryKey: ["public_posts"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function addComment() {
    if (!user) return;
    const body = comment.trim();
    if (body.length < 1) return;
    const { error } = await supabase
      .from("comments")
      .insert({ post_id: id, author_id: user.id, body });
    if (error) {
      toast.error(error.message);
      return;
    }
    setComment("");
    qc.invalidateQueries({ queryKey: ["comments", id] });
    qc.invalidateQueries({ queryKey: ["post", id] });
  }

  async function deleteComment(commentId: string) {
    const { error } = await supabase
      .from("comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", commentId);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["comments", id] });
  }

  async function deletePost() {
    if (!confirm("Delete this complaint?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted.");
    navigate({ to: "/feed" });
  }

  async function saveEdit() {
    const { error } = await supabase.from("posts").update({ body: editBody }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Updated. Votes were reset to keep things fair.");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["post", id] });
    qc.invalidateQueries({ queryKey: ["public_posts"] });
  }

  async function reportPost() {
    if (!user || !profile) {
      toast.error("Sign in to flag a post.");
      return;
    }
    const reason = window.prompt(
      "Why are you flagging this? (spam / abuse / defamation / offtopic / other)",
      "spam",
    );
    if (!reason) return;
    const r = reason.trim().toLowerCase();
    const allowed = ["spam", "abuse", "defamation", "offtopic", "other"];
    if (!allowed.includes(r)) {
      toast.error("Use one of: spam, abuse, defamation, offtopic, other.");
      return;
    }
    try {
      await flagPost(id, user.id, r as never);
      toast.success("Reported. An admin will review.");
      qc.invalidateQueries({ queryKey: ["myflag", id, user.id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <SiteShell>
      <Link to="/" className="text-xs text-muted-foreground hover:underline">
        ← Back to feed
      </Link>

      <article className="mt-4 rounded-xl border border-border bg-card p-6">
        <h1 className="sr-only">Complaint #{id.slice(0, 6)} — MUSE Students Voice</h1>
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
          </span>
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
              <ShieldCheck className="h-3 w-3" /> Verified true — escalated
            </span>
          )}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
            {LOCATION_LABEL[(p.location ?? "other") as Location] ?? "Other"}
          </span>
          <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
            {ISSUE_LABEL[(p.issue_type ?? "other") as IssueType] ?? "Other"}
          </span>
        </div>
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={6}
              maxLength={4000}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.body}</p>
        )}

        {owns.data && !locked && !editing && (
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditBody(p.body);
                setEditing(true);
              }}
            >
              <Pencil className="mr-1 h-3 w-3" /> Edit
            </Button>
            <Button size="sm" variant="outline" onClick={deletePost}>
              <Trash2 className="mr-1 h-3 w-3" /> Delete
            </Button>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <Button
            size="sm"
            variant={myVote.data === true ? "default" : "outline"}
            onClick={() => vote(true)}
            disabled={locked || !user || !profile}
          >
            <ThumbsUp className="mr-1 h-3.5 w-3.5" /> True ({p.true_count})
          </Button>
          <Button
            size="sm"
            variant={myVote.data === false ? "destructive" : "outline"}
            onClick={() => vote(false)}
            disabled={locked || !user || !profile}
          >
            <ThumbsDown className="mr-1 h-3.5 w-3.5" /> False ({p.false_count})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={reportPost}
            disabled={!user || !profile || myFlag.data}
            title={myFlag.data ? "You already reported this" : "Report this post"}
            className="ml-auto"
          >
            <Flag className="mr-1 h-3.5 w-3.5" />
            {myFlag.data ? "Reported" : "Report"}
          </Button>
        </div>

        <div className="mt-4 rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
          {total === 0 ? (
            <p className="text-muted-foreground">
              No votes yet. Quorum is <strong>{QUORUM} votes</strong>; a post is verified at ≥
              {THRESHOLD_PCT}% true and removed at ≥{THRESHOLD_PCT}% false.
            </p>
          ) : (
            <>
              <div className="mb-1 flex justify-between font-medium">
                <span>
                  {truePct}% true · {p.true_count}
                </span>
                <span>
                  {falsePct}% false · {p.false_count}
                </span>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-border">
                <div className="bg-primary" style={{ width: `${truePct}%` }} />
                <div className="bg-destructive" style={{ width: `${falsePct}%` }} />
              </div>
              <p className="mt-2 text-muted-foreground">
                {locked ? (
                  "Verified and escalated."
                ) : p.status === "deleted_false" ? (
                  "Community marked this false."
                ) : needed > 0 ? (
                  <>
                    Needs <strong>{needed}</strong> more vote{needed === 1 ? "" : "s"} to reach the{" "}
                    {QUORUM}-vote quorum.
                  </>
                ) : (
                  <>Quorum reached. Will resolve at ≥{THRESHOLD_PCT}% on either side.</>
                )}
              </p>
            </>
          )}
        </div>
      </article>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Comments ({comments.data?.length ?? 0})
        </h2>

        {user && profile ? (
          <div className="mb-4 rounded-lg border border-border bg-card p-3">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              rows={3}
              maxLength={2000}
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={addComment} disabled={!comment.trim()}>
                Post
              </Button>
            </div>
          </div>
        ) : (
          <p className="mb-4 text-xs text-muted-foreground">
            <Link to="/auth" className="underline">
              Sign in
            </Link>{" "}
            to comment.
          </p>
        )}

        {comments.data?.length === 0 && (
          <p className="text-xs text-muted-foreground">Be the first to comment.</p>
        )}
        <ul className="space-y-3">
          {comments.data?.map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-card p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono">
                  {c.pseudo_handle}
                  {c.is_mine && " · you"}
                </span>
                <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{c.body}</p>
              {(c.is_mine || owns.data) && (
                <button
                  className="mt-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => deleteComment(c.id)}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </SiteShell>
  );
}
