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