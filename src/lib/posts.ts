import { supabase } from "@/integrations/supabase/client";

export const POST_CATEGORIES = [
  "hostel",
  "mess",
  "academics",
  "transport",
  "exams",
  "infrastructure",
  "safety",
  "other",
] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<PostCategory, string> = {
  hostel: "Hostel",
  mess: "Mess",
  academics: "Academics",
  transport: "Transport",
  exams: "Exams",
  infrastructure: "Infrastructure",
  safety: "Safety",
  other: "Other",
};

export type PublicPost = {
  id: string;
  body: string;
  category: PostCategory;
  status: "open" | "verified_true" | "deleted_false" | "removed_by_author";
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  true_count: number;
  false_count: number;
  comment_count: number;
};

export async function fetchPublicPosts(opts?: { status?: "open" | "verified_true" }) {
  let q = supabase.from("public_posts").select("*").order("created_at", { ascending: false });
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PublicPost[];
}

export async function fetchPublicPost(id: string) {
  const { data, error } = await supabase.from("public_posts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as PublicPost | null;
}

export type PublicComment = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  pseudo_handle: string;
  is_mine: boolean;
};

export async function fetchComments(postId: string) {
  const { data, error } = await supabase
    .from("public_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PublicComment[];
}

export async function fetchMyVote(postId: string, userId: string) {
  const { data } = await supabase
    .from("votes")
    .select("value")
    .eq("post_id", postId)
    .eq("voter_id", userId)
    .maybeSingle();
  return data?.value ?? null;
}

export async function castVote(postId: string, userId: string, value: boolean) {
  const { error } = await supabase
    .from("votes")
    .upsert({ post_id: postId, voter_id: userId, value }, { onConflict: "post_id,voter_id" });
  if (error) throw error;
}

export async function clearVote(postId: string, userId: string) {
  const { error } = await supabase.from("votes").delete().eq("post_id", postId).eq("voter_id", userId);
  if (error) throw error;
}