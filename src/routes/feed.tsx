import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SiteShell } from "@/components/SiteShell";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicPosts, POST_CATEGORIES, CATEGORY_LABEL, type PostCategory } from "@/lib/posts";

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
  const [category, setCategory] = useState<PostCategory>("other");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "most_voted" | "trending">("newest");
  const [filterCat, setFilterCat] = useState<PostCategory | "all">("all");

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
    const { error } = await supabase.from("posts").insert({ author_id: user.id, body: parsed.data, category });
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
        <div className="mt-3">
          <label className="text-xs font-medium text-muted-foreground">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PostCategory)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-60"
          >
            {POST_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        </div>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe the issue clearly. Stick to facts."
          rows={5}
          className="mt-3"
          maxLength={4000}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{body.length}/4000 · max 3 posts/day</span>
          <Button onClick={submit} disabled={busy}>{busy ? "Posting…" : "Post complaint"}</Button>
        </div>
      </section>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="grow">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find by keyword…" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Category</label>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value as PostCategory | "all")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-44"
          >
            <option value="all">All</option>
            {POST_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
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
      ) : (() => {
          const q = search.trim().toLowerCase();
          let list = (data ?? []).filter((p) =>
            (filterCat === "all" || p.category === filterCat) &&
            (q === "" || p.body.toLowerCase().includes(q)),
          );
          if (sort === "most_voted") {
            list = [...list].sort((a, b) => (b.true_count + b.false_count) - (a.true_count + a.false_count));
          } else if (sort === "trending") {
            const cutoff = Date.now() - 24 * 60 * 60 * 1000;
            list = [...list].sort((a, b) => {
              const ta = new Date(a.created_at).getTime() > cutoff ? (a.true_count + a.false_count) * 2 : (a.true_count + a.false_count);
              const tb = new Date(b.created_at).getTime() > cutoff ? (b.true_count + b.false_count) * 2 : (b.true_count + b.false_count);
              return tb - ta;
            });
          }
          if (list.length === 0) {
            return <p className="text-sm text-muted-foreground">No matching complaints.</p>;
          }
          return <div className="space-y-3">{list.map((p) => <PostCard key={p.id} post={p} compact />)}</div>;
        })()}
    </SiteShell>
  );
}