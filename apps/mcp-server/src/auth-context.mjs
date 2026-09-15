/**
 * Parse Authorization: Bearer → Appwrite-bound MCP user context.
 */
import { verifyAccessToken, wwwAuthenticateChallenge, oauthConfigured } from "./oauth.mjs";

export function bearerFromRequest(req) {
  const h = req?.headers?.authorization || req?.headers?.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function authContextFromRequest(req) {
  if (!oauthConfigured()) {
    return { user: null, token: null, oauthReady: false };
  }
  const token = bearerFromRequest(req);
  if (!token) return { user: null, token: null, oauthReady: true };
  const user = verifyAccessToken(token);
  return { user, token, oauthReady: true };
}

export function authChallengeMeta({ error = "invalid_token", error_description } = {}) {
  return {
    "mcp/www_authenticate": [
      wwwAuthenticateChallenge({
        error,
        error_description:
          error_description ||
          "Sign in with Medicine Support Hub (Appwrite / Google) to use this tool.",
      }),
    ],
  };
}

export function authRequiredResult(message) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            error: "authentication_required",
            message:
              message ||
              "This tool requires a Medicine Support Hub login. Connect the MCP connector and sign in with Google / Appwrite.",
            login: "https://medicinesupport.app/mcp-oauth/",
            site: "https://medicinesupport.app/login",
          },
          null,
          2,
        ),
      },
    ],
    isError: true,
    _meta: authChallengeMeta(),
  };
}
