# MCP OAuth 2.1 — connect & login

Medicine Support Hub MCP **0.3.3** mixes public catalog tools with OAuth-protected account tools.

## Endpoints

| Path | Purpose |
|---|---|
| `https://mcp.medicinesupport.app/mcp` | Streamable HTTP MCP |
| `https://mcp.medicinesupport.app/.well-known/oauth-protected-resource` | RFC 9728 PRM |
| `https://mcp.medicinesupport.app/.well-known/oauth-authorization-server` | RFC 8414 AS metadata |
| `https://mcp.medicinesupport.app/oauth/authorize` | Auth code + PKCE (redirects to site login) |
| `https://mcp.medicinesupport.app/oauth/token` | Token endpoint |
| `https://mcp.medicinesupport.app/oauth/register` | Dynamic Client Registration |
| `https://medicinesupport.app/mcp-oauth/` | Appwrite/Google login bridge |

Resource URI (RFC 8707): `https://mcp.medicinesupport.app/mcp`  
Scope: `msh:user`


## Login bridge URL (trailing slash)

Appwrite Sites 301-redirects `/mcp-oauth` → `/mcp-oauth/` and **drops the query string**.
Authorize must therefore redirect to:

`https://medicinesupport.app/mcp-oauth/?ticket=…`

(slash **before** `?`). Returning `/mcp-oauth?ticket=…` loses the ticket and breaks login.

## Compact tickets + POST complete (0.3.3)

Authorize tickets no longer embed the full DCR `mshc_` client JWT. They carry a
short `cid_hash` (plus redirect_uri / PKCE fields) so the bridge URL stays well
under ~500 characters.

The site bridge (`/mcp-oauth/`) completes via **POST JSON** to
`/oauth/complete` with `{ ticket, appwrite_jwt }` and `Accept: application/json`.
MCP returns `200 { "redirect": "…" }` for XHR; plain GET without JSON Accept
still returns `302 Location` for backwards compatibility.

Never navigate the browser to `/oauth/complete?ticket=…&appwrite_jwt=…` — long
query strings truncated and produced `invalid_ticket`.


## How clients connect

1. Add MCP URL `https://mcp.medicinesupport.app/mcp` (ChatGPT Developer Mode, Grok Custom MCP, Claude connector, Codex, Gemini).
2. Public tools (`search_medicines`, …) work immediately (`securitySchemes: noauth`).
3. When a protected tool runs without a token, the server returns `isError` + `_meta["mcp/www_authenticate"]` pointing at protected-resource metadata.
4. The client starts OAuth 2.1 (DCR or CIMD if needed) → authorize → you sign in on **medicinesupport.app** with the existing Google/Appwrite session → MCP issues an access token bound to your Appwrite user id.

### ChatGPT / Codex

Plugins → + → MCP URL → when prompted, complete the Medicine Support Hub login.  
Or install the repo marketplace plugin, then use an account tool to trigger linking.

### Grok / xAI

```bash
grok mcp add --transport http msh https://mcp.medicinesupport.app/mcp
```

Use a protected tool (e.g. `whoami`) to start login.

### Claude

Add the remote MCP / install the Claude marketplace plugin, then invoke `whoami` or `list_my_requests`.

### Gemini

```bash
gemini mcp add --transport http msh https://mcp.medicinesupport.app/mcp
```

## Protected tools

- `whoami`
- `submit_support_request` → Appwrite `mcp_support_requests`
- `list_my_requests`
- `submit_prescription_request` → Appwrite `prescriptions` (+ optional items); deep-link `/rx/upload` for binary
- `submit_drug_contribution` → `drug_contributions`
- `list_my_watchlist` / `add_watchlist_item` / `check_my_price_alerts` → `user_watchlist`

## Redirect URI allowlist

Hosts matching: `chatgpt.com`, `openai.com`, `claude.ai` / `claude.com`, `grok.com` / `x.ai`, and loopback (`localhost`, `127.0.0.1`). DCR rejects other https hosts.

## Env (Vercel)

See `apps/mcp-server/.env.example`. Required for OAuth + writes:

- `MCP_OAUTH_SIGNING_SECRET`
- `APPWRITE_API_KEY`
- `APPWRITE_ENDPOINT` / `APPWRITE_PROJECT_ID` / `APPWRITE_DATABASE_ID`
- `PUBLIC_SITE_URL` / `MCP_PUBLIC_URL`

Provision collections once:

```bash
APPWRITE_API_KEY=... node scripts/provision-mcp-user-collections.mjs
```

## Vercel routing

Well-known metadata is served by dedicated API routes (not the catch-all `/api` rewrite), so `req.url` path collapse on Vercel cannot return health/discovery JSON:

| Public path | Vercel destination |
|---|---|
| `/.well-known/oauth-protected-resource` | `/api/oauth-protected-resource` |
| `/.well-known/oauth-authorization-server` | `/api/oauth-authorization-server` |
| `/.well-known/openid-configuration` | `/api/oauth-authorization-server` |
| `/oauth/:path*` | `/api/oauth/:path*` |

`requestPath()` in `src/rpc.mjs` also recovers paths from `x-forwarded-uri`, `x-invoke-path`, `x-matched-path`, and `__path` when present.


## Site deploy (`/mcp-oauth` SPA)

The login bridge lives in `apps/web` (`App.tsx` routes `/mcp-oauth` and `/mcp-oauth/`).
Pushing to `main` runs `.github/workflows/cd-deploy.yml`, which typechecks/builds the
web app and triggers an Appwrite Sites VCS redeploy (`scripts/appwrite-deploy.mjs --site`)
when `APPWRITE_SITE_ID` / API secrets are configured. MCP itself deploys separately via
the Vercel project for `mcp.medicinesupport.app` (watch health `version` after merge).
