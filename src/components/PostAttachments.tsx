import { useQuery } from "@tanstack/react-query";
import { fetchAttachmentUrls } from "@/lib/attachments";
import { Paperclip } from "lucide-react";

export function PostAttachments({ postId }: { postId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["post_attachments", postId],
    queryFn: () => fetchAttachmentUrls(postId),
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Paperclip className="h-3 w-3" />
        {data.length} {data.length === 1 ? "attachment" : "attachments"}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {data.map((a) => (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-lg border border-border bg-muted transition hover:border-primary/40"
          >
            <img
              src={a.url}
              alt="Attachment"
              loading="lazy"
              className="h-auto w-full object-contain"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export function AttachmentBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Paperclip className="h-3 w-3" />
      {count}
    </span>
  );
}