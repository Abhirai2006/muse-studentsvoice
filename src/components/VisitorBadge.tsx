import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Eye } from "lucide-react";

const STORAGE_KEY = "sv_session_id";
const HEARTBEAT_MS = 30_000;

function getSessionId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function VisitorBadge() {
  const [online, setOnline] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    const sessionId = getSessionId();
    let cancelled = false;

    async function heartbeat() {
      await supabase.rpc("record_visit", { _session_id: sessionId });
    }

    async function refresh() {
      const { data } = await supabase.rpc("get_visit_counts");
      const row = Array.isArray(data) ? data[0] : data;
      if (!cancelled && row) {
        setOnline(Number(row.online_count ?? 0));
        setTotal(Number(row.total_count ?? 0));
      }
    }

    heartbeat().then(refresh);
    const iv = setInterval(() => {
      heartbeat().then(refresh);
    }, HEARTBEAT_MS);

    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <Users className="h-3 w-3" />
        <strong className="text-foreground">{online ?? "—"}</strong> online
      </span>
      <span className="text-border">·</span>
      <span className="inline-flex items-center gap-1">
        <Eye className="h-3 w-3" />
        <strong className="text-foreground">{total ?? "—"}</strong> total visits
      </span>
    </div>
  );
}
