import { useEffect, useMemo, useRef, useState } from "react";
import type { LogLine } from "@/api/client";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";

interface Props { serverId: string }

export function LogViewer({ serverId }: Props) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const backfill = await api.recentLogs(serverId, 200);
        if (cancelled) return;
        setLines(backfill.lines);
      } catch {
        // ignore
      }
    })();
    const es = new EventSource(`/api/servers/${serverId}/logs/stream`, { withCredentials: true });
    es.onmessage = (e) => {
      if (pausedRef.current) return;
      try {
        const entry = JSON.parse(e.data) as LogLine;
        setLines(prev => {
          const next = [...prev, entry];
          if (next.length > 1000) next.splice(0, next.length - 1000);
          return next;
        });
      } catch { /* keepalive comment */ }
    };
    es.onerror = () => { /* let browser auto-retry */ };
    sourceRef.current = es;
    return () => { cancelled = true; es.close(); };
  }, [serverId]);

  useEffect(() => {
    if (paused) return;
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, paused]);

  const visible = useMemo(() => lines, [lines]);

  return (
    <div className="flex flex-col h-full border rounded-md bg-card">
      <div className="flex items-center justify-between p-2 border-b">
        <span className="text-sm font-medium text-muted-foreground">Live logs ({lines.length})</span>
        <div className="flex gap-1">
          <Button size="sm" variant={paused ? "default" : "outline"} onClick={() => setPaused(p => !p)}>
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLines([])}>Clear</Button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-scroll overflow-x-auto p-2 font-mono text-xs leading-snug">
        {visible.map((e, i) => (
          <div key={i} className={
            e.stream === "stderr" ? "text-destructive" :
            e.stream === "system" ? "text-warning-foreground" :
            "text-foreground"
          }>
            <span className="text-muted-foreground mr-2">{new Date(e.ts * 1000).toLocaleTimeString()}</span>
            {e.line}
          </div>
        ))}
        {visible.length === 0 && <div className="text-muted-foreground p-4 text-center">No logs yet.</div>}
      </div>
    </div>
  );
}
