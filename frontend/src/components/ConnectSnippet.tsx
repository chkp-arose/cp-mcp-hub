import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/CopyButton";

export interface SnippetServer {
  id: string;
  sseUrl: string;
}

interface Props {
  /** Servers to include in the generated configuration. */
  servers: SnippetServer[];
  token: string | null;
  title?: string;
  description?: string;
}

type Mode = "desktop" | "code";
type CodeStyle = "separate" | "chained";

/**
 * Renders a ready-to-paste connection snippet for the most common MCP
 * clients: a JSON object for `claude_desktop_config.json` and `claude mcp
 * add` commands for Claude Code. Accepts one or many servers — a single
 * server yields the per-server snippet, multiple servers yield one
 * consolidated configuration covering every enabled server at once. The
 * strings are kept in useMemo so copying multiple times during a 5s parent
 * refresh doesn't mutate them between clicks.
 */
export function ConnectSnippet({
  servers,
  token,
  title = "Connect a client",
  description = "Copy-paste configuration for the most common MCP clients.",
}: Props) {
  const [mode, setMode] = useState<Mode>("desktop");
  const [codeStyle, setCodeStyle] = useState<CodeStyle>("separate");

  // If the user has enabled TLS on the hub, the URLs will be https://...
  // with a self-signed cert. mcp-remote (Node) rejects self-signed certs
  // by default, so we need to inject NODE_TLS_REJECT_UNAUTHORIZED=0 into
  // the bridge process. Same for the Claude Code one-liner.
  const isSelfSigned = servers.some((s) => s.sseUrl.startsWith("https://"));
  const multi = servers.length > 1;

  const desktopJson = useMemo(() => {
    if (!token || servers.length === 0) return "";
    const entries: Record<string, unknown> = {};
    for (const s of servers) {
      const entry: Record<string, unknown> = {
        command: "npx",
        args: ["-y", "mcp-remote", s.sseUrl, "--header", `Authorization: Bearer ${token}`],
      };
      if (isSelfSigned) {
        entry.env = { NODE_TLS_REJECT_UNAUTHORIZED: "0" };
      }
      entries[`cp-${s.id}`] = entry;
    }
    return JSON.stringify({ mcpServers: entries }, null, 2);
  }, [servers, token, isSelfSigned]);

  const codeCommand = useMemo(() => {
    if (!token || servers.length === 0) return "";
    const prefix = isSelfSigned ? "NODE_TLS_REJECT_UNAUTHORIZED=0 " : "";
    if (codeStyle === "chained" && multi) {
      return servers
        .map((s) => `${prefix}claude mcp add cp-${s.id} --transport sse --header "Authorization: Bearer ${token}" ${s.sseUrl}`)
        .join(" && \\\n");
    }
    return servers
      .map((s) => `${prefix}claude mcp add cp-${s.id} \\\n  --transport sse \\\n  --header "Authorization: Bearer ${token}" \\\n  ${s.sseUrl}`)
      .join("\n");
  }, [servers, token, isSelfSigned, codeStyle, multi]);

  const active = mode === "desktop" ? desktopJson : codeCommand;
  const ready = !!token && servers.length > 0;
  const placeholder = servers.length === 0 ? "// no servers enabled yet…" : "// waiting for endpoint and token…";

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="flex items-center gap-1 border-b">
          <TabButton active={mode === "desktop"} onClick={() => setMode("desktop")}>
            Claude Desktop
          </TabButton>
          <TabButton active={mode === "code"} onClick={() => setMode("code")}>
            Claude Code
          </TabButton>
          <div className="ml-auto pb-1">
            <CopyButton value={ready ? active : null} label={`Copy ${mode === "desktop" ? "Claude Desktop snippet" : "Claude Code command"}`} />
          </div>
        </div>

        {mode === "code" && multi && (
          <div className="flex items-center gap-1 text-xs">
            <StyleButton active={codeStyle === "separate"} onClick={() => setCodeStyle("separate")}>
              Separate commands
            </StyleButton>
            <StyleButton active={codeStyle === "chained"} onClick={() => setCodeStyle("chained")}>
              Single chained command
            </StyleButton>
          </div>
        )}

        <pre
          className={
            "bg-muted px-3 py-2 rounded text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed " +
            (multi ? "max-h-64 overflow-y-auto" : "")
          }
        >
{ready ? active : placeholder}
        </pre>

        {mode === "desktop" ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Merge into <code className="font-mono">claude_desktop_config.json</code> (macOS:{" "}
            <code className="font-mono">~/Library/Application Support/Claude/</code>, Windows:{" "}
            <code className="font-mono">%APPDATA%\Claude\</code>), then fully quit and reopen Claude Desktop (Cmd/Ctrl+Q).
          </p>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {multi && codeStyle === "separate"
              ? "Run each command in your terminal."
              : multi
              ? "Paste the whole block; the commands run one after another."
              : "Run in your terminal."}{" "}
            Verify with <code className="font-mono">claude mcp list</code>.
          </p>
        )}

        {isSelfSigned && (
          <p className="text-xs text-warning-foreground bg-warning/15 rounded px-2 py-1.5 leading-relaxed">
            <strong>Self-signed TLS:</strong> the snippet includes{" "}
            <code className="font-mono">NODE_TLS_REJECT_UNAUTHORIZED=0</code>{" "}
            so the client accepts the hub's self-signed cert. For a stronger setup, install the hub's certificate into your system trust store or front the hub with a reverse proxy that has a real cert.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1.5 text-sm border-b-2 -mb-px transition-colors " +
        (active
          ? "border-berry text-foreground font-medium"
          : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function StyleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-2 py-0.5 rounded transition-colors " +
        (active
          ? "bg-berry/15 text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
