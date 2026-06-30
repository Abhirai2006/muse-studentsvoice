import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — MUSE Student Voice" },
      { name: "description", content: "Choose a new password for your MUSE Student Voice account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash and the client picks it up
    // automatically, firing PASSWORD_RECOVERY. We accept either signal.
    let settled = false;
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        settled = true;
        setReady("ok");
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (settled) return;
      setReady(data.session ? "ok" : "invalid");
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (password !== confirm) { toast.error("Passwords don't match."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Password updated.");
      setTimeout(() => navigate({ to: "/auth" }), 2000);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-sm rounded-xl border border-border bg-card p-6">
        <h1 className="font-serif text-xl font-semibold">Set a new password</h1>
        {ready === "checking" && <p className="mt-3 text-sm text-muted-foreground">Verifying reset link…</p>}
        {ready === "invalid" && (
          <p className="mt-3 text-sm">
            This reset link is invalid or has expired.{" "}
            <Link to="/auth" className="underline">Request a new one</Link>.
          </p>
        )}
        {ready === "ok" && !done && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="np">New password</Label>
              <Input id="np" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <div>
              <Label htmlFor="cp">Confirm password</Label>
              <Input id="cp" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <Button type="submit" disabled={busy} className="w-full">{busy ? "Updating…" : "Update password"}</Button>
          </form>
        )}
        {done && (
          <p className="mt-3 text-sm">Password updated. Redirecting you to sign in…</p>
        )}
      </div>
    </SiteShell>
  );
}