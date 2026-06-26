import { Link } from "@tanstack/react-router";
import { ShieldCheck, ThumbsUp, ThumbsDown, MessageCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { PublicPost } from "@/lib/posts";

export function PostCard({ post, compact }: { post: PublicPost; compact?: boolean }) {
  const total = post.true_count + post.false_count;
  const truePct = total > 0 ? Math.round((post.true_count / total) * 100) : 0;
  const verified = post.status === "verified_true";

  return (
    <Link
      to="/post/$id"
      params={{ id: post.id }}
      className="block rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow"
    >
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
        </span>
        {verified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
            <ShieldCheck className="h-3 w-3" /> Verified true
          </span>
        )}
      </div>
      <p className={compact ? "line-clamp-3 whitespace-pre-wrap text-sm" : "whitespace-pre-wrap text-sm"}>
        {post.body}
      </p>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ThumbsUp className="h-3.5 w-3.5 text-success" /> {post.true_count}
        </span>
        <span className="inline-flex items-center gap-1">
          <ThumbsDown className="h-3.5 w-3.5 text-destructive" /> {post.false_count}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5" /> {post.comment_count}
        </span>
        {total > 0 && (
          <span className="ml-auto">{truePct}% mark this true</span>
        )}
      </div>
    </Link>
  );
}