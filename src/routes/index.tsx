import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/SiteShell";
import { PostCard } from "@/components/PostCard";
import { PostCardSkeletonList } from "@/components/PostCardSkeleton";
import { fetchPublicPosts } from "@/lib/posts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { VisitorBadge } from "@/components/VisitorBadge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Students Voice — MUSE student complaints board" },
      { name: "description", content: "Public, anonymous board of student complaints from MUSE (Mysore University School of Engineering). Peer-verified issues are escalated to the Director and VC." },
      { property: "og:title", content: "Students Voice — MUSE student complaints board" },
      { property: "og:description", content: "Browse the latest complaints from MUSE students. See trending verified issues this week and a public record of what has been escalated to leadership." },
      { name: "twitter:title", content: "Students Voice — MUSE student complaints board" },
      { name: "twitter:description", content: "Browse the latest complaints from MUSE students. See trending verified issues this week and a public record of what has been escalated to leadership." },
      { property: "og:url", content: "https://muse-studentsvoice.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://muse-studentsvoice.lovable.app/" }],
  }),
  component: Index,
});

function Index() {
  const { user, profile } = useAuth();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["public_posts"],
    queryFn: () => fetchPublicPosts(),
  });

  const weekCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const verifiedAll = (data ?? []).filter((p) => p.status === "verified_true");
  const verifiedThisWeek = verifiedAll
    .filter((p) => p.resolved_at && new Date(p.resolved_at).getTime() > weekCutoff)
    .sort((a, b) => (b.true_count - b.false_count) - (a.true_count - a.false_count))
    .slice(0, 3);
  const totalOpen = (data ?? []).filter((p) => p.status === "open").length;
  const totalVerified = verifiedAll.length;

  return (
    <SiteShell>
      <section className="mb-8 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-serif text-2xl font-semibold">A record of student grievances</h1>
          <VisitorBadge />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Anyone can read. Only students with a verified USN can post or vote. Posts the community
          marks <strong className="text-primary">true</strong> are kept forever and emailed to the
          Director &amp; VC. Posts marked <strong>false</strong> by 70% of voters are auto-removed.
        </p>
        {!user && (
          <div className="mt-4">
            <Link to="/auth"><Button>Sign in with your USN</Button></Link>
          </div>
        )}
        {user && !profile && (
          <p className="mt-4 text-sm text-destructive">
            Your account isn't linked to a USN yet. <Link to="/auth" className="underline">Finish setup</Link>.
          </p>
        )}
      </section>

      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Open complaints</p>
          <p className="mt-1 font-serif text-2xl font-semibold">{totalOpen}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Verified &amp; escalated</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-primary">{totalVerified}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Verified this week</p>
          <p className="mt-1 font-serif text-2xl font-semibold">{verifiedThisWeek.length}</p>
        </div>
      </section>

      {verifiedThisWeek.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Trending verified this week
          </h2>
          <div className="space-y-3">
            {verifiedThisWeek.map((p) => <PostCard key={p.id} post={p} compact />)}
          </div>
        </section>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Latest complaints
      </h2>
      {isLoading ? (
        <PostCardSkeletonList count={4} />
      ) : isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center text-sm">
          <p>Something went wrong loading complaints.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Retrying…" : "Try again"}
          </Button>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <p>No complaints yet. Be the first to raise one.</p>
          <Link to={user && profile ? "/feed" : "/auth"} className="mt-3 inline-block">
            <Button size="sm">{user && profile ? "Post a complaint" : "Sign in with your USN"}</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((p) => <PostCard key={p.id} post={p} compact />)}
        </div>
      )}
    </SiteShell>
  );
}
