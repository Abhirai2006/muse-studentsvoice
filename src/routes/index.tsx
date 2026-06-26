import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/SiteShell";
import { PostCard } from "@/components/PostCard";
import { fetchPublicPosts } from "@/lib/posts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Student Voice — anonymous college complaints" },
      { name: "description", content: "Public, read-only feed of student complaints. Verified by peers, escalated to college leadership." },
      { property: "og:title", content: "Student Voice — anonymous college complaints" },
      { property: "og:description", content: "Public, read-only feed of student complaints. Verified by peers, escalated to college leadership." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, profile } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["public_posts"],
    queryFn: () => fetchPublicPosts(),
  });

  return (
    <SiteShell>
      <section className="mb-8 rounded-xl border border-border bg-card p-6">
        <h1 className="font-serif text-2xl font-semibold">A record of student grievances</h1>
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

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Latest complaints
      </h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No complaints posted yet. Be the first — sign in with your USN.
        </p>
      ) : (
        <div className="space-y-3">
          {data.map((p) => <PostCard key={p.id} post={p} compact />)}
        </div>
      )}
    </SiteShell>
  );
}
