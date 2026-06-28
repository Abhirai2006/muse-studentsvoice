import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/SiteShell";
import { PostCard } from "@/components/PostCard";
import { PostCardSkeletonList } from "@/components/PostCardSkeleton";
import { Button } from "@/components/ui/button";
import { fetchPublicPosts } from "@/lib/posts";

export const Route = createFileRoute("/verified")({
  head: () => ({
    meta: [
      { title: "Verified complaints — Student Voice" },
      { name: "description", content: "Complaints the community has verified as true. These are archived forever and mailed to college leadership." },
      { property: "og:description", content: "A permanent, anonymous record of complaints the MU SoE student community has marked credible and forwarded to the Director & VC." },
      { name: "twitter:description", content: "A permanent, anonymous record of complaints the MU SoE student community has marked credible and forwarded to the Director & VC." },
    ],
  }),
  component: VerifiedPage,
});

function VerifiedPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
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
        <PostCardSkeletonList count={3} />
      ) : isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center text-sm">
          <p>Something went wrong loading complaints.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Retrying…" : "Try again"}
          </Button>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No complaints have been verified yet. Keep voting on the public feed to help credible issues reach leadership.
        </p>
      ) : (
        <div className="space-y-3">{data.map((p) => <PostCard key={p.id} post={p} compact />)}</div>
      )}
    </SiteShell>
  );
}