import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ShieldCheck, LogOut, UserCircle2, Moon, Sun, Info } from "lucide-react";
import logo from "@/assets/mu-soe-logo.asset.json";
import { useTheme } from "@/lib/theme";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-serif text-lg font-semibold text-primary">
            <img src={logo.url} alt="MUSE" className="h-8 w-8 rounded-md object-contain ring-1 ring-border bg-card" />
            <span className="leading-tight">
              Student Voice
              <span className="block text-[10px] font-sans font-normal uppercase tracking-wider text-muted-foreground">MUSE · Mysore University School of Engineering</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/" className="rounded px-3 py-1.5 hover:bg-muted">Public</Link>
            <Link to="/verified" className="rounded px-3 py-1.5 hover:bg-muted">
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Verified</span>
            </Link>
            <Link to="/about" className="hidden rounded px-3 py-1.5 hover:bg-muted sm:inline-block">
              <span className="inline-flex items-center gap-1"><Info className="h-3.5 w-3.5" /> About</span>
            </Link>
            {user && profile && (
              <>
                <Link to="/feed" className="rounded px-3 py-1.5 hover:bg-muted">Feed</Link>
                <Link to="/my-complaints" className="hidden rounded px-3 py-1.5 hover:bg-muted sm:inline-block">Mine</Link>
              </>
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
                <Button size="sm" variant="ghost" onClick={toggle} aria-label="Toggle theme">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={signOut} aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={toggle} aria-label="Toggle theme">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                <Link to="/auth" className="ml-2">
                  <Button size="sm">Sign in</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <footer className="mt-12 border-t border-border bg-card/60 text-muted-foreground">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4">
          <div className="flex flex-col items-start gap-3">
            <img src={logo.url} alt="MUSE" className="h-12 w-12 rounded-md object-contain ring-1 ring-border bg-card" />
            <div className="font-serif text-base font-semibold text-foreground">Student Voice</div>
            <p className="text-xs leading-relaxed">
              MUSE · Mysore University<br />School of Engineering
            </p>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">Main Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-foreground">Public</Link></li>
              <li><Link to="/verified" className="hover:text-foreground">Verified</Link></li>
              <li><Link to="/about" className="hover:text-foreground">About</Link></li>
              <li><Link to="/feed" className="hover:text-foreground">Feed</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">Policies</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy" className="hover:text-foreground">Privacy &amp; Anonymity</Link></li>
              <li><Link to="/terms" className="hover:text-foreground">Terms of Use</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="mailto:bestofsnips431@gmail.com" className="hover:text-foreground break-all">bestofsnips431@gmail.com</a></li>
              <li className="text-xs">Mysore, Karnataka 570006</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <p className="mx-auto max-w-5xl px-4 py-4 text-center text-xs">
            © {new Date().getFullYear()} MUSE Student Voice. A peer-moderated record of student grievances. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}