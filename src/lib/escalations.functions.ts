import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function b64url(s: string) {
  return Buffer.from(s, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildLetter(opts: {
  to: string;
  toName: string;
  postId: string;
  body: string;
  trueCount: number;
  falseCount: number;
  createdAt: string;
  resolvedAt: string | null;
  publicUrl: string;
}) {
  const total = opts.trueCount + opts.falseCount;
  const pct = total ? Math.round((opts.trueCount * 100) / total) : 0;
  const subject = `Verified Student Complaint — Action Requested (Ref ${opts.postId.slice(0, 8).toUpperCase()})`;
  const text = [
    `Respected ${opts.toName},`,
    ``,
    `A student complaint has been verified as credible by the student community on the Student Voice platform and is hereby forwarded for your attention.`,
    ``,
    `Reference ID : ${opts.postId}`,
    `Submitted    : ${new Date(opts.createdAt).toLocaleString("en-IN")}`,
    `Verified at  : ${opts.resolvedAt ? new Date(opts.resolvedAt).toLocaleString("en-IN") : "—"}`,
    `Community vote: ${opts.trueCount} True / ${opts.falseCount} False  (${pct}% credibility)`,
    ``,
    `--- Complaint ---`,
    opts.body,
    `-----------------`,
    ``,
    `Author identity is withheld to protect the student per platform policy, but the author is a verified student of the institution (USN authenticated).`,
    ``,
    `Public record: ${opts.publicUrl}`,
    ``,
    `This letter was generated automatically by Student Voice on behalf of the student body of Maharaja Institute, University of Mysore.`,
  ].join("\r\n");

  const raw = [
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    text,
  ].join("\r\n");
  return b64url(raw);
}

export const runResolutionAndSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
    if (!lovableKey || !gmailKey) {
      throw new Error("Gmail connector is not configured.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Run the SQL resolver to flip statuses and create escalations rows.
    const { data: resolved, error: resolveErr } = await supabaseAdmin.rpc("resolve_posts");
    if (resolveErr) throw resolveErr;

    // 2) Find escalations that still need to be sent.
    const { data: pending, error: pendingErr } = await supabaseAdmin
      .from("escalations")
      .select("id, post_id, posts:posts!inner(id, body, status, created_at, resolved_at)")
      .is("sent_at", null);
    if (pendingErr) throw pendingErr;

    const verified = (pending ?? []).filter(
      (e: { posts: { status: string } | null }) => e.posts?.status === "verified_true",
    );
    if (verified.length === 0) {
      return { resolved, sent: 0, recipients: 0, skipped: 0 };
    }

    const { data: recipients, error: recErr } = await supabaseAdmin
      .from("recipients")
      .select("id, name, email, active")
      .eq("active", true);
    if (recErr) throw recErr;
    if (!recipients || recipients.length === 0) {
      return { resolved, sent: 0, recipients: 0, skipped: verified.length };
    }

    let sentCount = 0;
    let failed = 0;
    const origin = process.env.PUBLIC_SITE_URL ?? "https://muse-studentsvoice.lovable.app";

    for (const esc of verified as Array<{
      id: string;
      post_id: string;
      posts: { id: string; body: string; created_at: string; resolved_at: string | null };
    }>) {
      // tallies for this post
      const { data: votes } = await supabaseAdmin
        .from("votes")
        .select("value")
        .eq("post_id", esc.post_id);
      const trueCount = (votes ?? []).filter((v: { value: boolean }) => v.value).length;
      const falseCount = (votes ?? []).length - trueCount;

      let allOk = true;
      for (const r of recipients) {
        const raw = buildLetter({
          to: r.email,
          toName: r.name,
          postId: esc.post_id,
          body: esc.posts.body,
          trueCount,
          falseCount,
          createdAt: esc.posts.created_at,
          resolvedAt: esc.posts.resolved_at,
          publicUrl: `${origin}/post/${esc.post_id}`,
        });
        const resp = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": gmailKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        });
        if (!resp.ok) {
          allOk = false;
          const text = await resp.text();
          console.error("Gmail send failed", resp.status, text);
        }
      }

      if (allOk) {
        await supabaseAdmin
          .from("escalations")
          .update({
            sent_at: new Date().toISOString(),
            status: "sent",
            note: `Sent to ${recipients.length} recipient(s) via Gmail.`,
          })
          .eq("id", esc.id);
        sentCount += 1;
      } else {
        failed += 1;
      }
    }

    return { resolved, sent: sentCount, recipients: recipients.length, failed };
  });