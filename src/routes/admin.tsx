import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SiteShell } from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { runResolutionAndListLetters, markLetterSent, type PendingLetter } from "@/lib/escalations.functions";
import { generateLetterPDF } from "@/lib/letterPdf";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Student Voice" },
      { name: "description", content: "Manage recipients and resolve posts." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"director" | "vc" | "other">("director");

  const recipients = useQuery({
    queryKey: ["recipients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recipients").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && isAdmin,
  });
  const resolveAndList = useServerFn(runResolutionAndListLetters);
  const markSent = useServerFn(markLetterSent);
  const [letters, setLetters] = useState<PendingLetter[]>([]);
  const [running, setRunning] = useState(false);

  if (loading) return <SiteShell><p className="text-sm text-muted-foreground">Loading…</p></SiteShell>;
  if (!user) return <SiteShell><p>You need to <Link to="/auth" className="underline">sign in</Link>.</p></SiteShell>;
  if (!isAdmin) return <SiteShell><p className="text-sm">Admins only.</p></SiteShell>;

  async function addRecipient() {
    if (!email.trim() || !name.trim()) return;
    const { error } = await supabase.from("recipients").insert({ name, email, role });
    if (error) { toast.error(error.message); return; }
    setName(""); setEmail("");
    qc.invalidateQueries({ queryKey: ["recipients"] });
  }
  async function removeRecipient(id: string) {
    await supabase.from("recipients").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["recipients"] });
  }
  async function runResolve() {
    try {
      setRunning(true);
      const r = await resolveAndList();
      setLetters(r.letters);
      toast.success(
        `Resolved ${r.resolved}. ${r.letters.length} letter(s) ready to download.`,
      );
      qc.invalidateQueries({ queryKey: ["public_posts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to run resolution.");
    } finally {
      setRunning(false);
    }
  }

  async function downloadLetter(letter: PendingLetter) {
    const rec = (recipients.data ?? []) as Array<{ name: string; email: string; role: string }>;
    try {
      await generateLetterPDF(letter, rec);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate PDF.");
    }
  }

  async function markLetterDone(letter: PendingLetter) {
    try {
      await markSent({ data: { escalationId: letter.escalationId } });
      setLetters((prev) => prev.filter((l) => l.escalationId !== letter.escalationId));
      toast.success("Marked as sent.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark sent.");
    }
  }

  return (
    <SiteShell>
      <h1 className="mb-6 font-serif text-2xl font-semibold">Admin</h1>

      <section className="mb-8 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Escalation recipients</h2>
        <p className="mt-1 text-xs text-muted-foreground">Verified complaints are emailed to everyone in this list.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
          <div><Label htmlFor="rn" className="text-xs">Name</Label><Input id="rn" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label htmlFor="re" className="text-xs">Email</Label><Input id="re" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label htmlFor="rr" className="text-xs">Role</Label>
            <select id="rr" value={role} onChange={(e) => setRole(e.target.value as "director" | "vc" | "other")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="director">Director</option>
              <option value="vc">VC</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex items-end"><Button onClick={addRecipient}>Add</Button></div>
        </div>
        <ul className="mt-4 divide-y divide-border text-sm">
          {recipients.data?.map((r: { id: string; name: string; email: string; role: string }) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span><strong>{r.name}</strong> <span className="text-muted-foreground">· {r.email} · {r.role}</span></span>
              <button onClick={() => removeRecipient(r.id)} className="text-xs text-destructive hover:underline">Remove</button>
            </li>
          ))}
          {recipients.data?.length === 0 && <li className="py-2 text-xs text-muted-foreground">No recipients yet.</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Run resolution &amp; download letters</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Verifies or deletes posts that have crossed the vote threshold, then lists verified
          complaints as printable letters. Download each PDF and forward it to the Director / VC
          from your own email account, then mark it as sent.
        </p>
        <Button className="mt-3" onClick={runResolve} disabled={running}>
          {running ? "Running…" : "Run resolution"}
        </Button>

        {letters.length > 0 && (
          <ul className="mt-4 divide-y divide-border text-sm">
            {letters.map((l) => (
              <li key={l.escalationId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">Ref {l.postId.slice(0, 8).toUpperCase()}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{l.body}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {l.trueCount} True · {l.falseCount} False
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadLetter(l)}>Download PDF</Button>
                  <Button size="sm" onClick={() => markLetterDone(l)}>Mark sent</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SiteShell>
  );
}