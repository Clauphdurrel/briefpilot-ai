import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextAuthConfig } from "next-auth";
import { authLogger } from "../logger";

const adapter = vi.hoisted(() => ({
  createUser: vi.fn(), getUser: vi.fn(), getUserByEmail: vi.fn(), getUserByAccount: vi.fn(),
  updateUser: vi.fn(), linkAccount: vi.fn(), createSession: vi.fn(),
  getSessionAndUser: vi.fn(), updateSession: vi.fn(), deleteSession: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => adapter }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("AUTH_URL", "https://briefpilot.example");
  vi.stubEnv("AUTH_SECRET", "synthetic-auth-test-secret-not-a-real-credential");
  vi.stubEnv("AUTH_TRUST_HOST", "true");
  vi.stubEnv("AUTH_GOOGLE_ID", "synthetic-google-client");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "synthetic-google-secret");
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("External HTTP disabled in auth security tests"); }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("does not send adapter exception, cause or session data to the default Auth.js logger", async () => {
  const markers = ["synthetic-session-token", "synthetic-adapter-cause", "person@example.invalid"];
  adapter.getSessionAndUser.mockRejectedValue(new Error(markers.join(" ")));
  const logs = [vi.spyOn(console, "error").mockImplementation(() => {}), vi.spyOn(console, "warn").mockImplementation(() => {}), vi.spyOn(console, "log").mockImplementation(() => {})];
  const { handlers } = await import("@/auth");
  const response = await handlers.GET(new NextRequest("https://briefpilot.example/api/auth/session", {
    headers: { Cookie: `__Secure-authjs.session-token=${markers[0]}` },
  }));
  expect(adapter.getSessionAndUser).toHaveBeenCalledWith(markers[0]);
  expect(response.status).toBe(200);
  expect(await response.json()).toBeNull();
  const output = JSON.stringify(logs.map((spy) => spy.mock.calls));
  for (const marker of markers) expect(output).not.toContain(marker);
  expect(output).toContain("AUTH_ADAPTER_ERROR");
});

it("keeps HTTPS CSRF and callback cookies HttpOnly, Secure and SameSite=Lax", async () => {
  const { handlers } = await import("@/auth");
  const response = await handlers.GET(new NextRequest("https://briefpilot.example/api/auth/csrf"));
  expect(response.status).toBe(200);
  expect(typeof (await response.json()).csrfToken).toBe("string");
  const cookies = response.headers.getSetCookie();
  expect(cookies.some((cookie) => cookie.startsWith("__Host-authjs.csrf-token="))).toBe(true);
  for (const cookie of cookies) {
    expect(cookie).toMatch(/; HttpOnly/i);
    expect(cookie).toMatch(/; Secure/i);
    expect(cookie).toMatch(/; SameSite=Lax/i);
  }
});

it("keeps a real HTTPS database-session response cookie secure", async () => {
  adapter.getSessionAndUser.mockResolvedValue({
    user: { id: "synthetic-user", email: "person@example.invalid", name: "Test user", image: null },
    session: { userId: "synthetic-user", sessionToken: "synthetic-session-token", expires: new Date(Date.now() + 86400000) },
  });
  const { handlers } = await import("@/auth");
  const response = await handlers.GET(new NextRequest("https://briefpilot.example/api/auth/session", {
    headers: { Cookie: "__Secure-authjs.session-token=synthetic-session-token" },
  }));
  expect(response.status).toBe(200);
  expect((await response.json()).user.email).toBe("person@example.invalid");
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith("__Secure-authjs.session-token="));
  expect(cookie).toBeDefined();
  expect(cookie).toMatch(/; HttpOnly/i);
  expect(cookie).toMatch(/; Secure/i);
  expect(cookie).toMatch(/; SameSite=Lax/i);
});

it("refuses an OAuth callback without its PKCE cookie before token exchange", async () => {
  const transport = vi.fn(async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== "https://accounts.google.com/.well-known/openid-configuration") throw new Error("Unexpected external request disabled");
    return Response.json({ issuer: "https://accounts.google.com", authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      token_endpoint: "https://oauth2.googleapis.com/token", userinfo_endpoint: "https://openidconnect.googleapis.com/v1/userinfo",
      jwks_uri: "https://www.googleapis.com/oauth2/v3/certs" });
  });
  vi.stubGlobal("fetch", transport);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const { authLogger: runtimeLogger } = await import("../logger");
  const errors = vi.spyOn(runtimeLogger, "error");
  const { handlers } = await import("@/auth");
  const response = await handlers.GET(new NextRequest("https://briefpilot.example/api/auth/callback/google?code=synthetic-code&state=synthetic-state"));
  expect(response.status).toBe(302);
  expect(transport).toHaveBeenCalledOnce();
  expect(errors.mock.calls.some(([error]) => (error as { type?: string }).type === "InvalidCheck")).toBe(true);
  expect(JSON.stringify(log.mock.calls)).toMatch(/AUTH_INVALID_CHECK|AUTH_CALLBACK_ERROR/);
  expect(adapter.createSession).not.toHaveBeenCalled();
  expect(response.headers.getSetCookie().some((cookie) => cookie.startsWith("__Secure-authjs.session-token="))).toBe(false);
});

it("does not persist an external callback URL in the callback cookie", async () => {
  const { handlers } = await import("@/auth");
  const response = await handlers.GET(new NextRequest("https://briefpilot.example/api/auth/csrf?callbackUrl=https%3A%2F%2Fattacker.invalid%2F"));
  expect(response.status).toBe(200);
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith("__Secure-authjs.callback-url="));
  expect(cookie).toBeDefined();
  expect(decodeURIComponent(cookie!)).toContain("https://briefpilot.example");
  expect(cookie).not.toContain("attacker.invalid");
});

it("drops arbitrary warning/debug metadata and hostile error properties", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const hostile = Object.defineProperty(new Error("synthetic-private-message"), "type", { get() { throw new Error("synthetic-private-getter"); } });
  const sdkLogger: NonNullable<NextAuthConfig["logger"]> = authLogger;
  sdkLogger.error?.(hostile);
  sdkLogger.warn?.("synthetic-private-warning" as never);
  sdkLogger.debug?.("synthetic-private-message", { sessionToken: "synthetic-private-token" });
  expect(error).toHaveBeenCalledWith(JSON.stringify({ event: "auth_error", errorCode: "AUTH_ERROR" }));
  expect(warn).toHaveBeenCalledWith(JSON.stringify({ event: "auth_warning", errorCode: "AUTH_WARNING" }));
  expect(log).not.toHaveBeenCalled();
});

it("does not let a broken log destination replace the original auth behavior", () => {
  vi.spyOn(console, "error").mockImplementation(() => { throw new Error("synthetic-log-failure"); });
  vi.spyOn(console, "warn").mockImplementation(() => { throw new Error("synthetic-log-failure"); });
  expect(() => authLogger.error(new Error("synthetic-message"))).not.toThrow();
  expect(() => authLogger.warn()).not.toThrow();
});
