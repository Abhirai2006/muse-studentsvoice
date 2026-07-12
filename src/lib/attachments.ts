import { supabase } from "@/integrations/supabase/client";

export type PostAttachment = {
  id: string;
  post_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  order_index: number;
  created_at: string;
};

export const ATTACHMENT_BUCKET = "post-attachments";
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB per image
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export async function fetchAttachments(postId: string) {
  const { data, error } = await supabase
    .from("post_attachments")
    .select("id, post_id, storage_path, mime_type, size_bytes, order_index, created_at")
    .eq("post_id", postId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PostAttachment[];
}

export async function fetchAttachmentUrls(postId: string) {
  const rows = await fetchAttachments(postId);
  if (rows.length === 0) return [] as (PostAttachment & { url: string })[];
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      60 * 60, // 1 hour
    );
  if (error) throw error;
  return rows.map((r, i) => ({
    ...r,
    url: data?.[i]?.signedUrl ?? "",
  }));
}

export async function uploadPostAttachments(
  postId: string,
  userId: string,
  files: File[],
) {
  const uploads: {
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    order_index: number;
  }[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      throw new Error(`"${file.name}" is not a supported image type.`);
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`"${file.name}" is larger than 5 MB.`);
    }
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "img";
    const path = `${userId}/${postId}/${i}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    uploads.push({
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      order_index: i,
    });
  }
  if (uploads.length === 0) return;
  const { error } = await supabase.from("post_attachments").insert(
    uploads.map((u) => ({
      post_id: postId,
      uploaded_by: userId,
      ...u,
    })),
  );
  if (error) throw error;
}