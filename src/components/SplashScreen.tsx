import { useEffect, useState } from "react";
import logo from "@/assets/mu-soe-logo.asset.json";
import building from "@/assets/mu-soe-building.asset.json";

export function SplashScreen({ onDone }: { onDone?: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 700);
    const t2 = setTimeout(() => onDone?.(), 1050);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-500 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden={leaving}
    >
      <div className="absolute inset-0">
        <img src={building.url} alt="" className="h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/45 to-background/85" />
      </div>
      <div className="relative flex flex-col items-center text-center">
        <div className="relative animate-[fadeUp_700ms_ease-out_both]">
          {/* Soft outer glow */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-2xl opacity-70"
            style={{
              background:
                "radial-gradient(circle at center, hsl(var(--primary) / 0.55), transparent 65%)",
            }}
          />
          {/* Rotating conic ring */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-2 rounded-full animate-[spin_6s_linear_infinite]"
            style={{
              background:
                "conic-gradient(from 0deg, hsl(var(--primary) / 0.9), transparent 40%, hsl(var(--primary) / 0.6) 70%, transparent 100%)",
              WebkitMask:
                "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
            }}
          />
          {/* Logo disc */}
          <img
            src={logo.url}
            alt="MUSE — Mysore University School of Engineering"
            className="relative h-28 w-28 rounded-full object-contain bg-card p-3 ring-1 ring-border shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.7)] animate-[logoIn_900ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
          />
          {/* Orbit dot */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -ml-[62px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))] animate-[orbit_2.6s_linear_infinite] origin-[62px_3px]"
          />
        </div>
        <h1 className="mt-5 font-serif text-2xl font-semibold text-foreground animate-[fadeUp_900ms_ease-out_both]">
          Students Voice
        </h1>
        <p className="mt-1 text-sm text-muted-foreground animate-[fadeUp_1100ms_ease-out_both]">
          MUSE · Mysore University School of Engineering
        </p>
        <div className="mt-6 flex items-center gap-1.5 animate-[fadeUp_1300ms_ease-out_both]">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
        </div>
      </div>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes logoIn {
          0%   { opacity: 0; transform: scale(0.7) rotate(-8deg); }
          60%  { opacity: 1; transform: scale(1.06) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(62px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(62px) rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}
