import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ShieldCheck, ThumbsUp, ThumbsDown, Clock, Trash2, Pencil } from "lucide-react";
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
} from "@/lib/posts";

export const Route = createFileRoute("/post/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Complaint #${params.id.slice(0, 6)} — Student Voice` },
      { name: "description", content: "Anonymous student complaint, with peer voting and discussion." },
    ],
  }),
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
      const { data } = await supabase.from("posts").select("id").eq("id", id).eq("author_id", user.id).maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState("");

  if (post.isLoading) return <SiteShell><p className="text-sm text-muted-foreground">Loading…</p></SiteShell>;
  if (!post.data) return <SiteShell><p>Not found.</p></SiteShell>;

  const p = post.data;
  const total = p.true_count + p.false_count;
  const truePct = total > 0 ? Math.round((p.true_count / total) * 100) : 0;
  const locked = p.status === "verified_true";

  async function vote(value: boolean) {
    if (!user || !profile) { toast.error("Sign in with your USN to vote."); return; }
    try {
      if (myVote.data === value) {
        await clearVote(id, user.id);
      } else {
        await castVote(id, user.id, value);
      }
      qc.invalidateQueries({ queryKey: ["myvote", id, user.id] });
      qc.invalidateQueries({ queryKey: ["post", id] });
      qc.invalidateQueries({ queryKey: ["public_posts"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function addComment() {
    if (!user) return;
    const body = comment.trim();
    if (body.length < 1) return;
    const { error } = await supabase.from("comments").insert({ post_id: id, author_id: user.id, body });
    if (error) { toast.error(error.message); return; }
    setComment("");
    qc.invalidateQueries({ queryKey: ["comments", id] });
    qc.invalidateQueries({ queryKey: ["post", id] });
  }

  async function deleteComment(commentId: string) {
    const { error } = await supabase.from("comments").update({ deleted_at: new Date().toISOString() }).eq("id", commentId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["comments", id] });
  }

  async function deletePost() {
    if (!confirm("Delete this complaint?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted.");
    navigate({ to: "/feed" });
  }

  async function saveEdit() {
    const { error } = await supabase.from("posts").update({ body: editBody }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated. Votes were reset to keep things fair.");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["post", id] });
    qc.invalidateQueries({ queryKey: ["public_posts"] });
  }

  return (
    <SiteShell>
      <Link to="/" className="text-xs text-muted-foreground hover:underline">← Back to feed</Link>

      <article className="mt-4 rounded-xl border border-border bg-card p-6">
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
        {editing ? (
          <div className="space-y-2">
            <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={6} maxLength={4000} />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.body}</p>
        )}

        {owns.data && !locked && !editing && (
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditBody(p.body); setEditing(true); }}>
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
          {total > 0 && (
            <span className="text-xs text-muted-foreground">{truePct}% true · {total} votes</span>
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
              <Button size="sm" onClick={addComment} disabled={!comment.trim()}>Post</Button>
            </div>
          </div>
        ) : (
          <p className="mb-4 text-xs text-muted-foreground">
            <Link to="/auth" className="underline">Sign in</Link> to comment.
          </p>
        )}

        {comments.data?.length === 0 && (
          <p className="text-xs text-muted-foreground">Be the first to comment.</p>
        )}
        <ul className="space-y-3">
          {comments.data?.map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-card p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono">{c.pseudo_handle}{c.is_mine && " · you"}</span>
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