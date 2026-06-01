import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { api, type EnvVarDef, type ServerDetail } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SECRET_PLACEHOLDER = "********";

function placeholderFor(def: EnvVarDef): string {
  if (def.default) return `default: ${def.default}`;
  // Some fields are typed "url" in the manifest but actually expect a bare
  // IP address or hostname — a https://… example is misleading for those.
  if (/ip address or hostname/i.test(def.description)) {
    return "e.g. 192.0.2.1 or mgmt.example.com";
  }
  if (def.type === "url") return "https://…";
  return "";
}

type Value = string | boolean;

export interface ConfigFormState {
  config: Record<string, Value>;
  cli_args: string[];
  telemetry_enabled: boolean;
  restart_policy: "always" | "on-failure" | "never";
}

interface Props {
  server: ServerDetail;
  onSave: (state: ConfigFormState) => Promise<void>;
}

function initialFromServer(server: ServerDetail): ConfigFormState {
  const config: Record<string, Value> = {};
  for (const ev of server.definition.env_vars) {
    const v = server.config[ev.name];
    if (ev.type === "boolean") {
      config[ev.name] = typeof v === "boolean" ? v : v === "true";
    } else if (v === undefined || v === null) {
      config[ev.name] = ev.default ?? "";
    } else {
      config[ev.name] = String(v);
    }
  }
  return {
    config,
    cli_args: server.cli_args,
    telemetry_enabled: server.telemetry_enabled,
    restart_policy: server.restart_policy,
  };
}

export function ConfigForm({ server, onSave }: Props) {
  const initial = useMemo(() => initialFromServer(server), [server]);
  const [state, setState] = useState<ConfigFormState>(initial);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [revealLoading, setRevealLoading] = useState<Record<string, boolean>>({});
  // Maps field name -> revealed plaintext for fields the user has explicitly
  // un-masked. Used to (a) keep the dirty check accurate so revealing alone
  // doesn't enable Save, and (b) restore the sentinel on Discard.
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [cliText, setCliText] = useState(initial.cli_args.join(" "));

  // Only reset the form when navigating to a different server.
  // Without this guard, the parent's 5s polling overwrites whatever the user is typing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setState(initialFromServer(server));
    setCliText(server.cli_args.join(" "));
    setRevealed({});
    setShow({});
  }, [server.id]);

  // Build an "effective initial" that includes revealed plaintext for fields
  // the user has expanded but not edited. This keeps the form clean of
  // false-dirty state after a reveal-only interaction.
  const effectiveInitial = useMemo(() => {
    const cfg = { ...initial.config };
    for (const [k, v] of Object.entries(revealed)) {
      cfg[k] = v;
    }
    return { ...initial, config: cfg };
  }, [initial, revealed]);

  const dirty = JSON.stringify(state) !== JSON.stringify(effectiveInitial) || cliText !== initial.cli_args.join(" ");

  const missingRequired = server.definition.env_vars.filter(
    ev => ev.required && !state.config[ev.name] && (state.config[ev.name] !== SECRET_PLACEHOLDER)
  );

  function setField(name: string, value: Value) {
    setState(s => ({ ...s, config: { ...s.config, [name]: value } }));
  }

  async function toggleVisible(name: string) {
    const current = state.config[name];
    const isHiddenSentinel = current === SECRET_PLACEHOLDER;
    // If we're about to reveal and the value is still the server-side
    // sentinel, fetch the real plaintext from the backend first.
    if (!show[name] && isHiddenSentinel && !revealed[name]) {
      setRevealLoading(r => ({ ...r, [name]: true }));
      try {
        const r = await api.revealField(server.id, name);
        // Stash plaintext both as the visible state and as the revealed
        // baseline so the dirty check ignores this no-op replacement.
        setRevealed(prev => ({ ...prev, [name]: r.value }));
        setField(name, r.value);
      } catch {
        // Leave value as-is; just toggle the eye anyway so the user sees feedback
      } finally {
        setRevealLoading(r => ({ ...r, [name]: false }));
      }
    }
    setShow(s => ({ ...s, [name]: !s[name] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const cli_args = cliText.trim().split(/\s+/).filter(Boolean);
      await onSave({ ...state, cli_args });
      // After a save the server returns the sentinel again; reset reveal state.
      setRevealed({});
      setShow({});
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setState(initial);
    setCliText(initial.cli_args.join(" "));
    setRevealed({});
    setShow({});
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2.5">
        {server.definition.env_vars.length === 0 && (
          <p className="text-sm text-muted-foreground">This server has no documented environment variables. Use CLI args below if needed.</p>
        )}
        {server.definition.env_vars.map((ev) => (
          <Field key={ev.name} def={ev} value={state.config[ev.name] ?? ""}
            visible={!!show[ev.name]}
            revealLoading={!!revealLoading[ev.name]}
            onToggleVisible={() => toggleVisible(ev.name)}
            onChange={(v) => setField(ev.name, v)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="cli-args">CLI arguments</Label>
        <Input id="cli-args" value={cliText} onChange={(e) => setCliText(e.target.value)} placeholder="--region EU --infinity-portal-url https://..." />
        <p className="text-xs text-muted-foreground">Space-separated. Passed verbatim after the npm package name.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Restart policy</Label>
          <Select value={state.restart_policy} onValueChange={(v) => setState(s => ({ ...s, restart_policy: v as ConfigFormState["restart_policy"] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="on-failure">On failure</SelectItem>
              <SelectItem value="always">Always</SelectItem>
              <SelectItem value="never">Never</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Telemetry</Label>
          <div className="flex items-center gap-3 h-9">
            <Switch checked={state.telemetry_enabled} onCheckedChange={(v) => setState(s => ({ ...s, telemetry_enabled: v }))} />
            <span className="text-sm text-muted-foreground">{state.telemetry_enabled ? "Enabled (opt-in)" : "Disabled"}</span>
          </div>
        </div>
      </div>

      {missingRequired.length > 0 && (
        <p className="text-xs text-warning-foreground bg-warning/20 px-2 py-1 rounded">
          Required fields missing: {missingRequired.map(f => f.label).join(", ")}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</Button>
        <Button type="button" variant="outline" disabled={!dirty || saving} onClick={handleDiscard}>
          Discard
        </Button>
      </div>
    </form>
  );
}

interface FieldProps {
  def: EnvVarDef;
  value: Value;
  visible: boolean;
  revealLoading?: boolean;
  onToggleVisible: () => void;
  onChange: (v: Value) => void;
}

function Field({ def, value, visible, revealLoading, onToggleVisible, onChange }: FieldProps) {
  if (def.type === "boolean") {
    return (
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label className="flex items-center gap-2">{def.label}{def.required && <span className="text-destructive">*</span>}</Label>
          <p className="text-xs text-muted-foreground mt-1">{def.description}</p>
        </div>
        <Switch checked={!!value} onCheckedChange={onChange} />
      </div>
    );
  }
  const isPassword = def.type === "password" || def.secret;
  const inputType = isPassword && !visible ? "password" : def.type === "integer" ? "number" : "text";
  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-2">
        {def.label}
        {def.required && <span className="text-destructive">*</span>}
        <span className="font-mono text-xs text-muted-foreground">{def.name}</span>
      </Label>
      <div className="relative">
        <Input
          type={inputType}
          value={String(value)}
          placeholder={placeholderFor(def)}
          onChange={(e) => onChange(e.target.value)}
        />
        {isPassword && (
          <button type="button" onClick={onToggleVisible} disabled={revealLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label={visible ? "Hide value" : "Show value"}
            title={visible ? "Hide value" : (String(value) === SECRET_PLACEHOLDER ? "Click to reveal saved value" : "Show value")}
          >
            {revealLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {def.description && <p className="text-xs text-muted-foreground">{def.description}</p>}
    </div>
  );
}
