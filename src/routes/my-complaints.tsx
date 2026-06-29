import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { PostCardSkeletonList } from "@/components/PostCardSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LOCATION_LABEL, ISSUE_LABEL, type Location, type IssueType } from "@/lib/posts";
import { formatDistanceToNow } from "date-fns";
import { ShieldCheck, Clock, Trash2 } from "lucide-react";

export const Route = createFileRoute("/my-complaints")({
  head: () => ({
    meta: [
      { title: "My complaints — MUSE Student Voice" },
      { name: "description", content: "Private dashboard of complaints you submitted on MUSE Student Voice with current status (open, verified, removed) and live peer vote counts." },
      { property: "og:title", content: "My complaints — MUSE Student Voice" },
      { property: "og:description", content: "Track every complaint you posted on MUSE Student Voice — status, vote tallies, and comment activity in one place." },
      { name: "twitter:title", content: "My complaints — MUSE Student Voice" },
      { name: "twitter:description", content: "Track every complaint you posted on MUSE Student Voice — status, vote tallies, and comment activity in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyComplaints,
});

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  open: { label: "Open", tone: "bg-secondary text-secondary-foreground" },
  verified_true: { label: "Verified · escalated", tone: "bg-primary/10 text-primary" },
  deleted_false: { label: "Removed (false)", tone: "bg-destructive/10 text-destructive" },
  removed_by_author: { label: "Removed by you", tone: "bg-muted text-muted-foreground" },
};

function MyComplaints() {
  const { user, profile, loading } = useAuth();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["my_posts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: posts, error } = await supabase
        .from("posts")
        .select("id, body, location, issue_type, status, created_at, resolved_at")
        .eq("author_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch tallies via the public view in one go.
      const ids = (posts ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data: tallies } = await supabase
        .from("public_posts")
        .select("id, true_count, false_count, comment_count")
        .in("id", ids);
      const map = new Map((tallies ?? []).map((t) => [t.id, t]));
      return (posts ?? []).map((p) => ({
        ...p,
        true_count: map.get(p.id)?.true_count ?? 0,
        false_count: map.get(p.id)?.false_count ?? 0,
        comment_count: map.get(p.id)?.comment_count ?? 0,
      }));
    },
  });

  if (!loading && (!user || !profile)) {
    return (
      <SiteShell>
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm">Sign in with your USN to see your complaints.</p>
          <Link to="/auth" className="mt-3 inline-block"><Button>Sign in</Button></Link>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <h1 className="mb-1 font-serif text-2xl font-semibold">My complaints</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Only you can see this page. Status updates whenever the community votes resolve a post.
      </p>

      {isLoading ? (
        <PostCardSkeletonList count={3} />
      ) : isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center text-sm">
          <p>Couldn't load your complaints.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Retrying…" : "Try again"}
          </Button>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <p>You haven't posted any complaints yet.</p>
          <Link to="/feed" className="mt-3 inline-block"><Button size="sm">Post one now</Button></Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((p) => {
            const s = STATUS_LABEL[p.status] ?? STATUS_LABEL.open;
            return (
              <li key={p.id} className="rounded-lg border border-border bg-card p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                      {LOCATION_LABEL[((p as unknown as { location?: Location }).location ?? "other") as Location] ?? "Other"}
                    </span>
                    <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
                      {ISSUE_LABEL[((p as unknown as { issue_type?: IssueType }).issue_type ?? "other") as IssueType] ?? "Other"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                    </span>
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${s.tone}`}>
                    {p.status === "verified_true" && <ShieldCheck className="h-3 w-3" />}
                    {p.status === "removed_by_author" && <Trash2 className="h-3 w-3" />}
                    {s.label}
                  </span>
                </div>
                <Link to="/post/$id" params={{ id: p.id }} className="block text-sm hover:underline">
                  <p className="line-clamp-3 whitespace-pre-wrap">{p.body}</p>
                </Link>
                <p className="mt-2 text-xs text-muted-foreground">
                  {p.true_count} true · {p.false_count} false · {p.comment_count} comments
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </SiteShell>
  );
}