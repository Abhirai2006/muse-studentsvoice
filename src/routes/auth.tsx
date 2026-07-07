import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { SiteShell } from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MUSE Students Voice" },
      {
        name: "description",
        content:
          "Sign in or create an account on MUSE Students Voice using your Mysore University School of Engineering USN. One account per USN, enforced.",
      },
      { property: "og:title", content: "Sign in — MUSE Students Voice" },
      {
        property: "og:description",
        content:
          "Use your MUSE USN to sign in. One USN per student, no public name shown on any post or vote.",
      },
      { name: "twitter:title", content: "Sign in — MUSE Students Voice" },
      {
        name: "twitter:description",
        content:
          "Use your MUSE USN to sign in. One USN per student, no public name shown on any post or vote.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  usn: z
    .string()
    .trim()
    .regex(/^[0-9]{2}SE(AI|AD|CD|BR|CV)[0-9]{3}$/, "Enter a valid USN, e.g. 24SEAI003."),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});

// Normalize user input: uppercase, trim, and zero-pad a 1- or 2-digit numeric
// suffix to 3 digits so "23SEAD65" becomes "23SEAD065".
function normalizeUSN(input: string): string {
  const raw = input.toUpperCase().replace(/\s+/g, "");
  const m = raw.match(/^([0-9]{2}SE(?:AI|AD|CD|BR|CV))([0-9]{1,3})$/);
  if (!m) return raw;
  return m[1] + m[2].padStart(3, "0");
}

function AuthPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signup");
  const [usn, setUsn] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Already signed in + has profile → go to feed.
  useEffect(() => {
    if (user && profile) navigate({ to: "/feed" });
  }, [user, profile, navigate]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const normalizedUsn = normalizeUSN(usn);
    const parsed = signupSchema.safeParse({ usn: normalizedUsn, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setBusy(true);
    try {
      // Pre-check USN via safe RPC (registry is not publicly readable).
      const { data: status } = await supabase.rpc("check_usn_available", { _usn: parsed.data.usn });
      if (status === "invalid") {
        toast.error(
          `USN ${parsed.data.usn} isn't on our registry. If you believe this is an error, contact studentsvoice.muse@gmail.com.`,
        );
        setBusy(false);
        return;
      }
      if (status === "claimed") {
        toast.error(`USN ${parsed.data.usn} is already in use.`);
        setBusy(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { emailRedirectTo: window.location.origin + "/auth" },
      });
      if (error) throw error;
      // If email confirmation is required, session may be null.
      if (!data.session) {
        toast.success("Check your email to confirm, then sign back in to claim your USN.");
        setMode("signin");
        setBusy(false);
        return;
      }
      // Claim USN now that we have a session.
      const fp = await deviceFingerprint();
      const { error: claimErr } = await supabase.rpc("claim_usn", {
        _usn: parsed.data.usn,
        _fingerprint: fp ?? undefined,
        _ip_hash: undefined,
      });
      if (claimErr) {
        toast.error(claimErr.message);
        setBusy(false);
        return;
      }
      await refreshProfile();
      toast.success("Account created.");
      navigate({ to: "/feed" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // If they signed up before but never claimed a USN (e.g. confirmed email), claim now.
      if (data.user && usn) {
        const fp = await deviceFingerprint();
        await supabase.rpc("claim_usn", {
          _usn: normalizeUSN(usn),
          _fingerprint: fp ?? undefined,
          _ip_hash: undefined,
        });
      }
      await refreshProfile();
      navigate({ to: "/feed" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/reset-password",
      });
      setForgotSent(true);
    } catch {
      // Show neutral confirmation regardless (no account enumeration).
      setForgotSent(true);
    } finally {
      setBusy(false);
    }
  }

  // Signed in but no USN yet → just claim it.
  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const normalized = normalizeUSN(usn);
      const parsed = z
        .string()
        .regex(/^[0-9]{2}SE(AI|AD|CD|BR|CV)[0-9]{3}$/, "Enter a valid USN, e.g. 24SEAI003.")
        .parse(normalized);
      // Server-side registry check before claiming (via safe RPC).
      const { data: status } = await supabase.rpc("check_usn_available", { _usn: parsed });
      if (status === "invalid") {
        toast.error(
          `USN ${parsed} isn't on our registry. If you believe this is an error, contact studentsvoice.muse@gmail.com.`,
        );
        setBusy(false);
        return;
      }
      const fp = await deviceFingerprint();
      const { error } = await supabase.rpc("claim_usn", {
        _usn: parsed,
        _fingerprint: fp ?? undefined,
        _ip_hash: undefined,
      });
      if (error) throw error;
      await refreshProfile();
      toast.success("USN linked.");
      navigate({ to: "/feed" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (user && !profile) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-sm rounded-xl border border-border bg-card p-6">
          <h1 className="font-serif text-xl font-semibold">One last step</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Even with Google sign-in we still link one USN per account so duplicate posts and votes
            can be prevented. This can't be changed later. See{" "}
            <Link to="/privacy" className="underline">
              Privacy &amp; Anonymity
            </Link>
            .
          </p>
          <form onSubmit={handleClaim} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="usn">USN</Label>
              <Input
                id="usn"
                value={usn}
                onChange={(e) => setUsn(e.target.value)}
                placeholder="24SEAI001"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Linking…" : "Link USN"}
            </Button>
          </form>
        </div>
      </SiteShell>
    );
  }

  if (mode === "forgot") {
    return (
      <SiteShell>
        <div className="mx-auto max-w-sm rounded-xl border border-border bg-card p-6">
          <h1 className="font-serif text-xl font-semibold">Reset your password</h1>
          {forgotSent ? (
            <>
              <p className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
                If an account exists for that email, a reset link has been sent.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Didn&apos;t get the email? Check your spam folder, or contact the admin at{" "}
                <a href="mailto:studentsvoice.muse@gmail.com" className="underline">
                  studentsvoice.muse@gmail.com
                </a>
                .
              </p>
              <button
                className="mt-4 text-xs text-muted-foreground underline"
                onClick={() => {
                  setMode("signin");
                  setForgotSent(false);
                }}
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;ll send a password reset link to this email.
              </p>
              <form onSubmit={handleForgot} className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="fpemail">Email</Label>
                  <Input
                    id="fpemail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? "Sending…" : "Send reset link"}
                </Button>
              </form>
              <button
                className="mt-4 text-xs text-muted-foreground underline"
                onClick={() => setMode("signin")}
              >
                Back to sign in
              </button>
            </>
          )}
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-sm rounded-xl border border-border bg-card p-6">
        <h1 className="font-serif text-xl font-semibold">
          {mode === "signup" ? "Create your account" : "Sign in"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One account per USN. Your USN is never shown on posts, votes, or in the letter sent to
          leadership.
        </p>
        <form onSubmit={mode === "signup" ? handleSignup : handleSignin} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="usn">USN</Label>
            <Input
              id="usn"
              value={usn}
              onChange={(e) => setUsn(e.target.value)}
              placeholder="24SEAI001"
              required={mode === "signup"}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              We use your USN only to enforce one account per student.{" "}
              <Link to="/privacy" className="underline">
                How your USN is stored &amp; protected
              </Link>
              .
            </p>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            {mode === "signin" && (
              <div className="mt-1 text-right">
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                  onClick={() => {
                    setForgotSent(false);
                    setMode("forgot");
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin + "/auth",
              });
              if (result.error) throw new Error(result.error.message ?? "Google sign-in failed");
              if (result.redirected) return;
              await refreshProfile();
              navigate({ to: "/feed" });
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Continue with Google
        </Button>
        <button
          className="mt-4 text-xs text-muted-foreground underline"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </SiteShell>
  );
}

async function deviceFingerprint(): Promise<string | null> {
  try {
    const parts = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
    ].join("|");
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}
