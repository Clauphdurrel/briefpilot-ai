import "server-only";
import type { NextAuthConfig } from "next-auth";
import { reportError } from "@/server/observability/errors";
import { withOperation } from "@/server/observability/context";

const errorCodes: Record<string, string> = {
  AdapterError: "AUTH_ADAPTER_ERROR",
  SessionTokenError: "AUTH_SESSION_ERROR",
  OAuthCallbackError: "AUTH_OAUTH_CALLBACK_ERROR",
  OAuthSignInError: "AUTH_OAUTH_SIGNIN_ERROR",
  CallbackRouteError: "AUTH_CALLBACK_ERROR",
  InvalidCheck: "AUTH_INVALID_CHECK",
  AccessDenied: "AUTH_ACCESS_DENIED",
  MissingSecret: "AUTH_CONFIGURATION_ERROR",
  UntrustedHost: "AUTH_UNTRUSTED_HOST",
};

function errorCode(error: unknown) {
  try {
    const type = error && typeof error === "object" && "type" in error ? error.type : undefined;
    return typeof type === "string" && Object.hasOwn(errorCodes, type) ? errorCodes[type] : "AUTH_ERROR";
  } catch { return "AUTH_ERROR"; }
}

// Override all levels: Auth.js otherwise falls back to its raw error/metadata
// logger for each missing method. Never pass original objects to the console.
export const authLogger = {
  error(error) {
    try {
      const code = errorCode(error);
      console.error(JSON.stringify({ event: "auth_error", errorCode: code }));
      if (code !== "AUTH_INVALID_CHECK" && code !== "AUTH_ACCESS_DENIED") {
        withOperation({ module: "auth" }, () => reportError(error, { module: "auth", errorCode: code }));
      }
    }
    catch { /* Logging must not change authentication behavior. */ }
  },
  warn() {
    try { console.warn(JSON.stringify({ event: "auth_warning", errorCode: "AUTH_WARNING" })); }
    catch { /* Logging must not change authentication behavior. */ }
  },
  debug() { /* Adapter arguments and OAuth metadata must never be logged. */ },
} satisfies NonNullable<NextAuthConfig["logger"]>;
