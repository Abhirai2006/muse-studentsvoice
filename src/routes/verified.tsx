import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/SiteShell";
import { PostCard } from "@/components/PostCard";
import { fetchPublicPosts } from "@/lib/posts";

export const Route = createFileRoute("/verified")({
  head: () => ({
    meta: [
      { title: "Verified complaints — Student Voice" },
      { name: "description", content: "Complaints the community has verified as true. These are archived forever and mailed to college leadership." },
    ],
  }),
  component: VerifiedPage,
});

function VerifiedPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["public_posts", "verified_true"],
    queryFn: () => fetchPublicPosts({ status: "verified_true" }),
  });
  return (
    <SiteShell>
      <h1 className="mb-1 font-serif text-2xl font-semibold">Verified complaints</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Marked true by ≥70% of voters. Kept on record permanently and escalated to the Director &amp; VC.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No verified complaints yet.
        </p>
      ) : (
        <div className="space-y-3">{data.map((p) => <PostCard key={p.id} post={p} compact />)}</div>
      )}
    </SiteShell>
  );
}