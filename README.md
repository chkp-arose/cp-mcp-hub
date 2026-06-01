<h1 align="center">Check Point MCP Hub</h1>

<p align="center">
  <b>A self-hosted control plane for Check Point's MCP servers.</b><br>
  Enable, configure, and monitor every <code>@chkp/*-mcp</code> server through a browser, then connect them to Claude, Cursor, or any MCP client over a single endpoint.
</p>

<p align="center">
  Powered by the official <a href="https://github.com/CheckPointSW/mcp-servers"><b>CheckPointSW/mcp-servers</b></a> package set.
</p>

<p align="center">
  <a href="https://hub.docker.com/r/aaronroseio/cp-mcp-hub"><img alt="Docker Hub" src="https://img.shields.io/badge/docker-aaronroseio%2Fcp--mcp--hub-2496ED?logo=docker&logoColor=white"></a>
  <a href="https://github.com/CheckPointSW/mcp-servers"><img alt="Upstream" src="https://img.shields.io/badge/upstream-CheckPointSW%2Fmcp--servers-181717?logo=github&logoColor=white"></a>
  <img alt="Architecture" src="https://img.shields.io/badge/arch-amd64%20%7C%20arm64-lightgrey">
  <a href="https://github.com/chkp-arose/cp-mcp-hub/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue"></a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/chkp-arose/cp-mcp-hub/main/docs/images/dashboard.png" alt="Dashboard with servers grouped by Check Point solution pillar" width="900">
</p>

---

## 🤔 Before you start: pick your deployment

This tool runs in a Docker container. Where you put that container changes one important thing: whether you need HTTPS.

<table>
<tr>
<th>👉 Option A — Run on your own laptop</th>
<th>🌐 Option B — Run on another machine (NAS, home server, VPS)</th>
</tr>
<tr>
<td valign="top">

You run Docker on the same machine where you use Claude. You open the UI at <code>http://localhost:8090</code> in your browser.

- **Easiest setup.** No certificates, no hostnames.
- Plain <b>HTTP is fine</b> because the browser treats <code>localhost</code> as trusted.
- Best for: trying it out, single-user workflows on one laptop.

➡️ Follow the **[Quickstart](#-quickstart)** below as-is.

</td>
<td valign="top">

The container runs somewhere else and you connect to it from a different machine.

- You need <b>HTTPS</b> because Claude Desktop and Claude Code refuse plain HTTP for remote URLs.
- The hub can generate a self-signed certificate for you — one extra environment variable.
- Best for: home labs, team shared deployments, anything reachable from more than one device.

➡️ Follow the **[Quickstart](#-quickstart)** below, then **[Enable HTTPS](#enable-https-self-signed)** before connecting Claude.

</td>
</tr>
</table>

---

## 🚀 Quickstart

You need [Docker](https://www.docker.com/products/docker-desktop/). That's it. Three commands.

```bash
# 1. Generate a master encryption key (save this somewhere safe!)
docker run --rm aaronroseio/cp-mcp-hub:latest generate-key
# prints something like: 4Te6XpFq2j8N9k...long-base64-string...=

# 2. Run the hub (paste the key from step 1)
docker run -d --name cp-mcp-hub \
  -e MASTER_KEY='paste-your-key-here' \
  -v cp-mcp-hub-data:/data \
  -p 8090:8000 \
  aaronroseio/cp-mcp-hub:latest

# 3. Open the UI
open http://localhost:8090     # macOS
# or visit http://localhost:8090 in your browser
```

**First login:** `admin` / `admin`. You'll be required to set a new password (min 12 characters).

> 💡 **Save your `MASTER_KEY` somewhere safe** (password manager, 1Password, etc). If you lose it, you'll have to re-enter every credential — there's no way to recover the encrypted data without it.

> 🔀 **Port `8090` already in use?** The `-p 8090:8000` flag maps **port 8090 on your computer** to **port 8000 inside the container**. If 8090 is taken, change the number on the left, e.g. `-p 9090:8000`, then open `http://localhost:9090` instead. Keep `8000` on the right alone.

> 🌐 **Running on another machine?** After the steps above work, go to **[Enable HTTPS](#enable-https-self-signed)** to add a certificate so Claude Desktop will accept the connection.

---

## 📸 What it looks like

<table>
<tr>
<td width="50%">
<img src="https://raw.githubusercontent.com/chkp-arose/cp-mcp-hub/main/docs/images/login.png" alt="Login screen">
<br><sub><b>Login.</b> Single-user admin in v1.</sub>
</td>
<td width="50%">
<img src="https://raw.githubusercontent.com/chkp-arose/cp-mcp-hub/main/docs/images/server-detail.png" alt="Server configuration, endpoint, and live logs">
<br><sub><b>Server detail.</b> Configure env vars, copy the SSE endpoint, watch logs live.</sub>
</td>
</tr>
<tr>
<td width="50%">
<img src="https://raw.githubusercontent.com/chkp-arose/cp-mcp-hub/main/docs/images/pillar-group.png" alt="Servers grouped by Check Point solution pillar">
<br><sub><b>Pillar grouping.</b> Organized by Check Point's four solution pillars.</sub>
</td>
<td width="50%">
<img src="https://raw.githubusercontent.com/chkp-arose/cp-mcp-hub/main/docs/images/settings.png" alt="Settings page with token rotation dialog">
<br><sub><b>Settings.</b> Rotate the SSE bearer, change admin password, see system info.</sub>
</td>
</tr>
</table>

---

## 🔌 Connecting an MCP client

Once you've enabled a server in the UI, copy the **SSE URL** and the **Bearer token** from its detail page.

> 💡 **Connecting more than one server?** Every server's detail page also has a **Connect all enabled servers** panel. It generates a single configuration covering every server currently enabled on the hub — paste it once instead of repeating the steps below per server. The Claude Code tab offers both separate and chained command formats.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) and add an entry that bridges through `mcp-remote`:

```json
{
  "mcpServers": {
    "cp-quantum-management": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:8090/servers/quantum-management/sse",
        "--header",
        "Authorization: Bearer YOUR_TOKEN_HERE"
      ]
    }
  }
}
```

Quit Claude Desktop fully (Cmd+Q) and reopen. The tools appear in the chat's tool picker.

### Claude Code

One command:

```bash
claude mcp add cp-quantum-management \
  --transport sse \
  --header "Authorization: Bearer YOUR_TOKEN_HERE" \
  http://localhost:8090/servers/quantum-management/sse
```

Confirm with `claude mcp list`.

### Quick smoke test (curl)

```bash
curl -N -H "Authorization: Bearer YOUR_TOKEN" -H "Accept: text/event-stream" \
  http://localhost:8090/servers/quantum-management/sse
```

You should see SSE handshake data within a second or two. Ctrl+C to stop.

---

## 🐳 Other ways to run

### Docker Compose

A starter compose file is included. See [`docker-compose.example.yml`](https://github.com/chkp-arose/cp-mcp-hub/blob/main/docker-compose.example.yml). Copy it, paste your `MASTER_KEY`, then:

```bash
docker compose -f docker-compose.example.yml up -d
```

### Enable HTTPS (self-signed)

Claude Desktop / Claude Code reject plain HTTP for any URL that isn't `localhost`. If you're running the hub on another machine (NAS, home server, VPS, etc.) and want to connect from your laptop, you need HTTPS.

The fastest path: flip on the built-in TLS mode. The container generates a self-signed cert on first boot (persisted in your `/data` volume so it survives restarts).

```bash
docker run -d --name cp-mcp-hub \
  -e MASTER_KEY='paste-your-key-here' \
  -e ENABLE_TLS=true \
  -e TLS_HOSTNAMES='localhost,127.0.0.1,my-server.local,192.168.1.50' \
  -v cp-mcp-hub-data:/data \
  -p 8090:8000 \
  aaronroseio/cp-mcp-hub:latest
```

Open `https://my-server.local:8090` in your browser. You'll get a "Not secure" warning — that's expected for a self-signed cert. Click through (Advanced → Proceed) or, for a cleaner setup, import `/data/tls/cert.pem` into your machine's trust store.

The on-screen Claude Desktop / Claude Code snippets on each server detail page automatically detect HTTPS and inject `NODE_TLS_REJECT_UNAUTHORIZED=0` so `mcp-remote` accepts the cert. For a stronger setup, see the next section.

### Behind a reverse proxy (Caddy, Traefik, Tailscale Serve, etc.)

The UI has **no built-in TLS or extra auth** beyond the single admin user. **Do not expose the hub directly to the internet.** Put it behind a proxy that terminates TLS and adds another auth layer.

If your proxy serves the hub at a public URL (e.g. `https://mcp.example.com`), set `EXTERNAL_BASE_URL` so the UI displays the right SSE URLs in copy-to-clipboard fields:

```bash
docker run -d --name cp-mcp-hub \
  -e MASTER_KEY='...' \
  -e EXTERNAL_BASE_URL='https://mcp.example.com' \
  -v cp-mcp-hub-data:/data \
  -p 8090:8000 \
  aaronroseio/cp-mcp-hub:latest
```

---

## ⚙️ Configuration reference

| Variable             | Required | Default                                          | Purpose |
|----------------------|----------|--------------------------------------------------|---------|
| `MASTER_KEY`         | **yes**  |                                                  | 32-byte url-safe base64 Fernet key. Container exits if missing or invalid. |
| `SECRET_KEY`         | no       | derived from `MASTER_KEY`                        | Signs the session cookie. |
| `DATABASE_URL`       | no       | `sqlite+aiosqlite:////data/cp-mcp-hub.db`        | SQLite path (rarely changed). |
| `HOST`               | no       | `0.0.0.0`                                        | Bind address. |
| `PORT`               | no       | `8000`                                           | Port uvicorn listens on **inside** the container. Map to a host port with `-p HOST:8000`. |
| `MCP_PROXY_PORT`     | no       | `8001`                                           | Internal mcp-proxy port (loopback). |
| `DATA_DIR`           | no       | `/data`                                          | DB + per-server log files live here. |
| `MANIFEST_PATH`      | no       | `/app/server_definitions.json`                   | Manifest of all known `@chkp/*-mcp` servers. |
| `EXTERNAL_BASE_URL`  | no       | (empty)                                          | If set, the UI displays this in SSE URL copy fields. e.g. `https://mcp.example.com`. |
| `ENABLE_TLS`         | no       | `false`                                          | Serve uvicorn over HTTPS with a self-signed cert. Required for Claude Desktop / Claude Code over a remote URL. |
| `TLS_HOSTNAMES`      | no       | `localhost,127.0.0.1`                            | Comma-separated DNS names and IPs to embed in the cert's SAN list. Add your LAN hostname / IP here. |
| `TLS_CERT_PATH`      | no       | `$DATA_DIR/tls/cert.pem`                         | Override only if mounting an externally-generated cert. |
| `TLS_KEY_PATH`       | no       | `$DATA_DIR/tls/key.pem`                          | Override only if mounting an externally-generated key. |
| `LOG_LEVEL`          | no       | `INFO`                                           | Standard Python log level. |

---

## 🔒 Security model

- **`MASTER_KEY` is the only secret that unlocks the database.** Lose it, and the encrypted credentials are useless. Back it up out of band.
- All saved credentials (API keys, passwords, tokens marked `secret` in the manifest) are encrypted at rest with **Fernet** (AES-128-CBC + HMAC-SHA256).
- The web UI is **single-user (`admin`) in v1**. Don't expose it to the internet without a reverse proxy enforcing TLS and additional auth.
- The SSE bearer token is **global**. It authorizes access to every enabled MCP server. Rotate it from **Settings** whenever you suspect compromise.
- The plaintext form value is **never** returned by the API. The UI displays `********` for stored secrets and preserves them on save when left unchanged.
- Telemetry to Check Point is **off by default** for every server (`TELEMETRY_DISABLED=true` is injected into the child env). Opt in per-server in the UI.
- The container runs as a non-root user (`cpmcp`, UID 10001). `docker history` does not contain plaintext secrets.

---

## 🗄️ Backup, restore, upgrade

**Backup.** Snapshot the data volume. You also need to keep `MASTER_KEY` somewhere safe; the volume alone is useless without it.

```bash
docker run --rm -v cp-mcp-hub-data:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/cp-mcp-hub-backup-$(date +%F).tar.gz /data
```

**Restore.** Untar into a fresh volume, then start the container with the same `MASTER_KEY`.

```bash
docker volume create cp-mcp-hub-data
docker run --rm -v cp-mcp-hub-data:/data -v "$(pwd)":/backup alpine \
  tar xzf /backup/cp-mcp-hub-backup-YYYY-MM-DD.tar.gz -C /
```

**Upgrade.** Pull and recreate. State and credentials persist in the volume.

```bash
docker pull aaronroseio/cp-mcp-hub:latest
docker stop cp-mcp-hub && docker rm cp-mcp-hub
# re-run the same `docker run ...` command from Quickstart step 2.
```

Want a reproducible build? Use a `:sha-<short>` tag instead of `:latest`.

---

## 🆘 Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Container exits immediately with `FATAL: MASTER_KEY env var is required` | Forgot the env var | Re-run with `-e MASTER_KEY='...'` |
| Container exits with `MASTER_KEY is not a valid 32-byte url-safe base64 Fernet key` | Pasted truncated or bad key | Regenerate: `docker run --rm aaronroseio/cp-mcp-hub:latest generate-key` |
| Health check fails / `http://localhost:8090` shows nothing | Port 8090 already in use on the host, or container still booting | Change the host side of the port mapping (e.g. `-p 9090:8000`) and open the new port, or wait ~10s and re-check |
| Server card stuck on `Starting` | The `@chkp/*-mcp` package failed to launch | `docker logs cp-mcp-hub \| grep -i error`. Usually a missing or wrong env var on the server's config page. |
| SSE endpoint returns 401 | Wrong or old bearer token | Re-copy from **Settings** page. Tokens are rotated by the rotate button. |
| SSE endpoint returns 404 | Server is not enabled, or just got disabled | Toggle it on from the dashboard. |
| `must_change_password: true` keeps redirecting | First login state | Set a new password (min 12 chars). This is required only once. |

For more verbose logs: `docker run ... -e LOG_LEVEL=DEBUG ...`

---

## 🏗️ Architecture (brief)

```
public :8000 ──► FastAPI (PID 1) ─┬─ /              SPA (React)
                                  ├─ /api/*         management API
                                  └─ /servers/*  ──► mcp-proxy :8001 (loopback)
                                                       ├─ @chkp/quantum-management-mcp  (Node, stdio)
                                                       ├─ @chkp/documentation-mcp       (Node, stdio)
                                                       └─ ... up to 15 enabled servers
```

- **FastAPI** is PID 1 and supervises a single `mcp-proxy` child via `asyncio.subprocess`.
- **mcp-proxy** in named-servers mode fans incoming SSE requests out to per-server Node subprocesses.
- **SQLite** at `/data/cp-mcp-hub.db` holds server state, encrypted credentials, the admin user, and the bearer token.
- All `@chkp/*-mcp` packages are baked into the image. No network access is needed at runtime.

---

## 👩‍💻 Development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
export MASTER_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
export DATA_DIR=./data && mkdir -p ./data
alembic upgrade head
uvicorn app.main:app --factory --reload --port 8000
```

```bash
# Frontend (separate shell)
cd frontend
npm install
npm run dev    # proxies /api and /servers to localhost:8000
```

```bash
# Tests
cd backend && pytest -q
```

### Refresh the server manifest

`server_definitions.json` is generated from the upstream CheckPointSW/mcp-servers repo. CI regenerates this weekly and opens a PR if anything changed.

```bash
python scripts/build_manifest.py
```

### Building the image locally

```bash
docker build -t cp-mcp-hub:dev .
```

Multi-arch builds for `linux/amd64` and `linux/arm64` are published by CI on every push to `main`, every `v*` tag, and weekly.

---

## 📂 What's out of scope (v1)

Per-server SSE tokens · OIDC/SSO · multi-user · TLS termination inside the container · Prometheus metrics · auto-updating MCP packages in a running container · UI-driven backup/export · hub self-telemetry.

---

## 📜 License

Licensed under the [Apache License 2.0](https://github.com/chkp-arose/cp-mcp-hub/blob/main/LICENSE). See [NOTICE](https://github.com/chkp-arose/cp-mcp-hub/blob/main/NOTICE) for third-party attributions.

This is community tooling for [CheckPointSW/mcp-servers](https://github.com/CheckPointSW/mcp-servers) and is not an official Check Point product.

Check Point® is a registered trademark of Check Point Software Technologies Ltd.
