import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SiteShell } from "@/components/SiteShell";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicPosts } from "@/lib/posts";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Feed — Student Voice" },
      { name: "description", content: "Post a complaint or vote on others." },
    ],
  }),
  component: FeedPage,
});

const bodySchema = z.string().trim().min(10, "At least 10 characters").max(4000, "Keep it under 4000 characters");

function FeedPage() {
  const { user, profile, loading } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["public_posts"],
    queryFn: () => fetchPublicPosts(),
    enabled: !loading,
  });

  if (!loading && !user) {
    return (
      <SiteShell>
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm">You need to sign in to post or vote.</p>
          <Link to="/auth" className="mt-3 inline-block"><Button>Sign in</Button></Link>
        </div>
      </SiteShell>
    );
  }
  if (!loading && user && !profile) {
    return (
      <SiteShell>
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm">Link a USN to your account first.</p>
          <Link to="/auth" className="mt-3 inline-block"><Button>Link USN</Button></Link>
        </div>
      </SiteShell>
    );
  }

  async function submit() {
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("posts").insert({ author_id: user.id, body: parsed.data });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setBody("");
    toast.success("Complaint posted.");
    qc.invalidateQueries({ queryKey: ["public_posts"] });
  }

  return (
    <SiteShell>
      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">New complaint</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Posting as <span className="font-mono">{profile?.usn}</span> — your USN is never shown to other users.
        </p>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe the issue clearly. Stick to facts."
          rows={5}
          className="mt-3"
          maxLength={4000}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{body.length}/4000</span>
          <Button onClick={submit} disabled={busy}>{busy ? "Posting…" : "Post complaint"}</Button>
        </div>
      </section>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">All complaints</h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <div className="space-y-3">{data.map((p) => <PostCard key={p.id} post={p} compact />)}</div>
      )}
    </SiteShell>
  );
}