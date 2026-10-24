import { beforeEach, expect, it, vi } from "vitest";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { signInWithGoogle, logout } from "@/server/actions/auth.actions";

vi.mock("@/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`synthetic-redirect:${path}`); }) }));
beforeEach(() => { vi.resetAllMocks(); vi.mocked(redirect).mockImplementation((path) => { throw new Error(`synthetic-redirect:${path}`); }); });

it.each([[signInWithGoogle, signIn, "/login?error=OAuthSignin"], [logout, signOut, "/login?error=Configuration"]] as const)("replaces raw AuthError causes with a fixed login redirect: %s", async (action, sdkAction, path) => {
  const failure = new AuthError("synthetic-private-provider-detail", { cause: { err: new Error("synthetic-private-cause") } });
  vi.mocked(sdkAction).mockRejectedValueOnce(failure);
  await expect(action()).rejects.toThrow(`synthetic-redirect:${path}`);
  expect(redirect).toHaveBeenCalledWith(path);
});
it.each([[signInWithGoogle, signIn], [logout, signOut]] as const)("preserves framework redirect/control-flow exceptions: %s", async (action, sdkAction) => {
  const redirectSignal = new Error("NEXT_REDIRECT");
  vi.mocked(sdkAction).mockRejectedValueOnce(redirectSignal);
  await expect(action()).rejects.toBe(redirectSignal);
  expect(redirect).not.toHaveBeenCalled();
});
