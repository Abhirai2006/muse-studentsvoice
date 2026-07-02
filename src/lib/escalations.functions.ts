import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PendingLetter = {
  escalationId: string;
  postId: string;
  body: string;
  createdAt: string;
  resolvedAt: string | null;
  trueCount: number;
  falseCount: number;
};

export type FlaggedPost = {
  postId: string;
  body: string;
  status: string;
  createdAt: string;
  flagCount: number;
  reasons: string[];
  notes: string[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

async function buildLetters(supabaseAdmin: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
}): Promise<PendingLetter[]> {
  const { data: pending, error } = await supabaseAdmin
    .from("escalations")
    .select("id, post_id, posts:posts!inner(id, body, status, created_at, resolved_at)")
    .is("sent_at", null);
  if (error) throw error;

  const verified = (pending ?? []).filter(
    (e: { posts: { status: string } | null }) => e.posts?.status === "verified_true",
  );

  const letters: PendingLetter[] = [];
  for (const esc of verified as Array<{
    id: string;
    post_id: string;
    posts: { body: string; created_at: string; resolved_at: string | null };
  }>) {
    const { data: votes } = await supabaseAdmin
      .from("votes")
      .select("value")
      .eq("post_id", esc.post_id);
    const trueCount = (votes ?? []).filter((v: { value: boolean }) => v.value).length;
    const falseCount = (votes ?? []).length - trueCount;
    letters.push({
      escalationId: esc.id,
      postId: esc.post_id,
      body: esc.posts.body,
      createdAt: esc.posts.created_at,
      resolvedAt: esc.posts.resolved_at,
      trueCount,
      falseCount,
    });
  }
  return letters;
}

/** List pending letters without running resolution (for the admin dashboard). */
export const listPendingLetters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return { letters: await buildLetters(supabaseAdmin) };
  });

/** List posts that students have flagged, with counts and reasons. */
export const listFlaggedPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ flagged: FlaggedPost[] }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("post_flags")
      .select("post_id, reason, note, posts:posts!inner(id, body, status, created_at)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const byPost = new Map<string, FlaggedPost>();
    for (const row of (data ?? []) as Array<{
      post_id: string;
      reason: string;
      note: string | null;
      posts: { body: string; status: string; created_at: string };
    }>) {
      const existing = byPost.get(row.post_id);
      if (existing) {
        existing.flagCount += 1;
        existing.reasons.push(row.reason);
        if (row.note) existing.notes.push(row.note);
      } else {
        byPost.set(row.post_id, {
          postId: row.post_id,
          body: row.posts.body,
          status: row.posts.status,
          createdAt: row.posts.created_at,
          flagCount: 1,
          reasons: [row.reason],
          notes: row.note ? [row.note] : [],
        });
      }
    }
    return { flagged: Array.from(byPost.values()).sort((a, b) => b.flagCount - a.flagCount) };
  });

/** Admin removes a post (and its flags/votes/comments cascade via FKs). */
export const adminDeletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ postId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("post_flags").delete().eq("post_id", data.postId);
    await supabaseAdmin.from("comments").delete().eq("post_id", data.postId);
    await supabaseAdmin.from("votes").delete().eq("post_id", data.postId);
    await supabaseAdmin.from("escalations").delete().eq("post_id", data.postId);
    const { error } = await supabaseAdmin.from("posts").delete().eq("id", data.postId);
    if (error) throw error;
    return { ok: true };
  });

/** Admin dismisses all flags on a post without deleting the post. */
export const adminDismissFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ postId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("post_flags").delete().eq("post_id", data.postId);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Admin action: run the resolver (marks posts verified/deleted based on votes)
 * and return the list of verified escalations that still need a letter sent.
 * Emails are no longer sent automatically — the admin downloads the PDF and
 * forwards it manually to the Director / VC.
 */
export const runResolutionAndListLetters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: resolved, error: resolveErr } = await supabaseAdmin.rpc("resolve_posts");
    if (resolveErr) throw resolveErr;

    const { data: pending, error: pendingErr } = await supabaseAdmin
      .from("escalations")
      .select("id, post_id, posts:posts!inner(id, body, status, created_at, resolved_at)")
      .is("sent_at", null);
    if (pendingErr) throw pendingErr;

    const verified = (pending ?? []).filter(
      (e: { posts: { status: string } | null }) => e.posts?.status === "verified_true",
    );

    const letters: PendingLetter[] = [];
    for (const esc of verified as Array<{
      id: string;
      post_id: string;
      posts: { body: string; created_at: string; resolved_at: string | null };
    }>) {
      const { data: votes } = await supabaseAdmin
        .from("votes")
        .select("value")
        .eq("post_id", esc.post_id);
      const trueCount = (votes ?? []).filter((v: { value: boolean }) => v.value).length;
      const falseCount = (votes ?? []).length - trueCount;
      letters.push({
        escalationId: esc.id,
        postId: esc.post_id,
        body: esc.posts.body,
        createdAt: esc.posts.created_at,
        resolvedAt: esc.posts.resolved_at,
        trueCount,
        falseCount,
      });
    }

    return { resolved: resolved ?? 0, letters };
  });

/**
 * Admin marks an escalation letter as "sent" after downloading the PDF and
 * forwarding it manually.
 */
export const markLetterSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ escalationId: z.string().uuid(), note: z.string().max(500).optional() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("escalations")
      .update({
        sent_at: new Date().toISOString(),
        status: "sent",
        note: data.note ?? "Letter PDF downloaded and forwarded manually.",
      })
      .eq("id", data.escalationId);
    if (error) throw error;
    return { ok: true };
  });