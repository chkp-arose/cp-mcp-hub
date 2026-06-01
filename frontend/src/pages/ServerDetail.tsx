import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, Github, Loader2 } from "lucide-react";
import { api, type ServerDetail as ServerDetailT } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfigForm } from "@/components/ConfigForm";
import { LogViewer } from "@/components/LogViewer";
import { CopyButton } from "@/components/CopyButton";
import { ConnectSnippet, type SnippetServer } from "@/components/ConnectSnippet";

type Action = "start" | "stop" | "restart";

function effectiveState(server: ServerDetailT): string {
  if (!server.enabled) return "disabled";
  // DB says enabled but orchestrator hasn't reconciled yet — show as transitional.
  if (server.state === "disabled") return "starting";
  return server.state;
}


export function ServerDetail() {
  const { id = "" } = useParams();
  const [server, setServer] = useState<ServerDetailT | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sseUrl, setSseUrl] = useState<string | null>(null);
  const [enabledServers, setEnabledServers] = useState<SnippetServer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<Action | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, t, st, list] = await Promise.all([
        api.getServer(id),
        api.getToken(),
        api.serverStatus(id),
        api.listServers(),
      ]);
      setServer(s);
      setToken(t.token);
      const currentSseUrl = new URL(st.sse_url, window.location.origin).toString();
      setSseUrl(currentSseUrl);
      // Every server's SSE endpoint shares the same base; derive it from this
      // server's URL so the consolidated snippet works under EXTERNAL_BASE_URL
      // and TLS without an extra round-trip per server.
      const sseBase = currentSseUrl.replace(/\/servers\/[^/]+\/sse$/, "");
      setEnabledServers(
        list.servers
          .filter((sv) => sv.enabled)
          .sort((a, b) => a.display_name.localeCompare(b.display_name))
          .map((sv) => ({ id: sv.id, sseUrl: `${sseBase}/servers/${sv.id}/sse` })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "load failed");
    }
  }, [id]);

  async function runAction(kind: Action) {
    setActionBusy(kind);
    setActionError(null);
    setActionMsg(null);
    try {
      if (kind === "start") await api.enableServer(id);
      else if (kind === "stop") await api.disableServer(id);
      else await api.restartServer(id);
      // Brief settle delay so the immediate refresh has a chance to see the new state
      await new Promise((r) => setTimeout(r, 400));
      await refresh();
      setActionMsg(
        kind === "start" ? "Server starting…" :
        kind === "stop"  ? "Server stopped." :
                           "Server restarting…"
      );
      // Auto-clear success message after a few seconds
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "action failed";
      setActionError(msg);
    } finally {
      setActionBusy(null);
    }
  }

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!server) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/" className="text-sm text-primary hover:underline">← Servers</Link>
        <div className="mt-1 flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">{server.display_name}</h1>
          <StatusBadge state={effectiveState(server)} />
        </div>
        {server.description && <p className="text-sm text-muted-foreground mt-1">{server.description}</p>}
        {server.doc_url && (
          <a
            href={server.doc_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 text-sm text-berry hover:underline font-medium"
            title="View this server's full documentation and tool list on GitHub"
          >
            <Github className="h-4 w-4" />
            View on CheckPointSW/mcp-servers
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4 flex flex-col">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Environment variables for <code className="font-mono text-xs">{server.definition.npm_package}</code></CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ConfigForm
                server={server}
                onSave={async (state) => {
                  await api.updateConfig(id, {
                    config: state.config,
                    cli_args: state.cli_args,
                    telemetry_enabled: state.telemetry_enabled,
                    restart_policy: state.restart_policy,
                  });
                  await refresh();
                }}
              />
            </CardContent>
          </Card>

          <ConnectSnippet
            servers={sseUrl ? [{ id, sseUrl }] : []}
            token={token}
            title="Connect this server"
            description="Copy-paste configuration for just this server."
          />
        </div>

        <div className="space-y-4 flex flex-col">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle>Endpoint</CardTitle>
              <CardDescription>Connect an MCP client to this server.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">SSE URL</p>
                <div className="flex gap-2 items-center">
                  <code className="flex-1 truncate bg-muted px-2 py-1 rounded text-xs font-mono">{sseUrl ?? ""}</code>
                  <CopyButton value={sseUrl} label="Copy SSE URL" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Bearer token (global)</p>
                <div className="flex gap-2 items-center">
                  <code className="flex-1 truncate bg-muted px-2 py-1 rounded text-xs font-mono">{token ?? ""}</code>
                  <CopyButton value={token} label="Copy bearer token" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Button
                  variant="outline"
                  disabled={server.enabled || actionBusy !== null}
                  onClick={() => runAction("start")}
                >
                  {actionBusy === "start" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {actionBusy === "start" ? "Starting…" : "Start"}
                </Button>
                <Button
                  variant="outline"
                  disabled={!server.enabled || actionBusy !== null}
                  onClick={() => runAction("stop")}
                >
                  {actionBusy === "stop" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {actionBusy === "stop" ? "Stopping…" : "Stop"}
                </Button>
                <Button
                  variant="outline"
                  disabled={!server.enabled || actionBusy !== null}
                  onClick={() => runAction("restart")}
                >
                  {actionBusy === "restart" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {actionBusy === "restart" ? "Restarting…" : "Restart"}
                </Button>
              </div>
              {actionMsg && (
                <div className="text-xs text-success bg-success/10 rounded px-2 py-1">
                  {actionMsg}
                </div>
              )}
              {actionError && (
                <div className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded px-2 py-1">
                  {actionError}
                </div>
              )}
              <div className="text-xs text-muted-foreground pt-2">
                <span>State: <strong className="text-foreground">{effectiveState(server)}</strong></span>
                {server.pid && <span className="ml-3">PID: {server.pid}</span>}
                {server.uptime_seconds > 0 && <span className="ml-3">Uptime: {Math.round(server.uptime_seconds)}s</span>}
              </div>
              {server.last_error && (
                <div className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded px-2 py-1">
                  {server.last_error}
                </div>
              )}
            </CardContent>
          </Card>

          <ConnectSnippet
            servers={enabledServers}
            token={token}
            title="Connect all enabled servers"
            description="One configuration covering every server currently enabled on the hub."
          />

          <div className="h-[480px]">
            <LogViewer serverId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}
