import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ShieldCheck, LogOut, UserCircle2 } from "lucide-react";
import logo from "@/assets/mu-soe-logo.asset.json";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-serif text-lg font-semibold text-primary">
            <img src={logo.url} alt="MU SoE" className="h-8 w-8 rounded-md object-contain ring-1 ring-border bg-card" />
            <span className="leading-tight">
              Student Voice
              <span className="block text-[10px] font-sans font-normal uppercase tracking-wider text-muted-foreground">MU School of Engineering</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/" className="rounded px-3 py-1.5 hover:bg-muted">Public</Link>
            <Link to="/verified" className="rounded px-3 py-1.5 hover:bg-muted">
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Verified</span>
            </Link>
            {user && profile && (
              <Link to="/feed" className="rounded px-3 py-1.5 hover:bg-muted">Feed</Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="rounded px-3 py-1.5 hover:bg-muted">Admin</Link>
            )}
            {user ? (
              <div className="ml-2 flex items-center gap-2">
                <span className="hidden items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground sm:inline-flex">
                  <UserCircle2 className="h-3.5 w-3.5" />
                  {profile?.usn ?? "no USN"}
                </span>
                <Button size="sm" variant="ghost" onClick={signOut} aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Link to="/auth" className="ml-2">
                <Button size="sm">Sign in</Button>
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Identities are kept hidden. Verified complaints are mailed to the Director &amp; VC.
      </footer>
    </div>
  );
}