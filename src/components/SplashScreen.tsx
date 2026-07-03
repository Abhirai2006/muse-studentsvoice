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
        <img
          src={building.url}
          alt=""
          className="h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/45 to-background/85" />
      </div>
      <div className="relative flex flex-col items-center text-center">
        <div className="animate-[fadeUp_700ms_ease-out_both]">
          <img
            src={logo.url}
            alt="MUSE — Mysore University School of Engineering"
            className="h-28 w-28 rounded-2xl object-contain shadow-xl ring-1 ring-border bg-card p-2"
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
      `}</style>
    </div>
  );
}