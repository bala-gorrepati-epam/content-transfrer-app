"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { Button } from "@/src/components/ui/button";
import { LoadingSpinner } from "@/src/components/ui/loading-spinner";
import { AccessTokenContext, type GetAccessToken } from "@/src/utils/hooks/useAccessToken";

interface CustomAuthProviderProps {
  organizationId: string | undefined;
  tenantId: string | undefined;
  children: ReactNode;
}

// Auth0 errors that mean the user has to sign in interactively, for example when no refresh token is stored yet.
const SIGN_IN_REQUIRED_ERRORS = ["missing_refresh_token", "login_required", "consent_required", "interaction_required"];

function needsSignIn(error: unknown): boolean {
  const code = (error as { error?: unknown } | null)?.error;
  return typeof code === "string" && SIGN_IN_REQUIRED_ERRORS.includes(code);
}

// Settings come from NEXT_PUBLIC_* variables (see CLAUDE.md). They are public values, not secrets.
// Each variable is read by its full name so Next.js can inline it into the browser bundle.
function readAuthConfig() {
  const domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
  const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
  const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;
  const scope = process.env.NEXT_PUBLIC_AUTH0_SCOPE;
  const appId = process.env.NEXT_PUBLIC_SITECORE_APP_ID;
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL;
  if (!domain || !clientId || !audience || !scope || !appId || !appBaseUrl) return null;
  return { domain, clientId, audience, scope, appId, appBaseUrl };
}

// Set while the user is sent to sign in. If the user comes back without a session, the flag is still set, so the
// page shows a Sign in button instead of redirecting again (which would loop).
const LOGIN_ATTEMPT_KEY = "content-transfer-login-attempt";

function setLoginAttempt(active: boolean) {
  try {
    if (active) window.sessionStorage.setItem(LOGIN_ATTEMPT_KEY, "1");
    else window.sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
  } catch {
    // Storage can be blocked. The Sign in button is the fallback then.
  }
}

function hasLoginAttempt(): boolean {
  try {
    return window.sessionStorage.getItem(LOGIN_ATTEMPT_KEY) === "1";
  } catch {
    return false;
  }
}

function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <p className="text-sm">Sign in to Sitecore to continue. You will be brought back to this page.</p>
      <Button onClick={onSignIn}>Sign in</Button>
    </div>
  );
}

// Shows the app only to a signed-in user, as in the reference setup (withAuthenticationRequired). The features
// mount after Auth0 has finished loading, so no token request runs before the sign-in callback is complete.
function AuthenticatedApp({ children }: { children: ReactNode }) {
  const { getAccessTokenSilently, loginWithRedirect, isLoading, isAuthenticated } = useAuth0();
  const [signInNeeded, setSignInNeeded] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      setLoginAttempt(false);
      return;
    }
    // Came back from sign-in without a session: the render below shows the Sign in button. Do not redirect again.
    if (hasLoginAttempt()) return;
    setLoginAttempt(true);
    void loginWithRedirect();
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  // The provider already sends organization_id and tenant_id with every call, so none are repeated here.
  const getAccessToken: GetAccessToken = useCallback(async () => {
    let token: string | undefined;
    try {
      token = await getAccessTokenSilently();
    } catch (err) {
      if (needsSignIn(err)) {
        // Auth0 error codes and descriptions are not secrets. Tokens are never logged.
        console.error(
          "Auth0 sign-in required:",
          String((err as { error?: unknown }).error),
          (err as { error_description?: unknown }).error_description,
        );
        setSignInNeeded(true);
        throw new Error("Sign in to load items.");
      }
      throw err;
    }
    // Without a token the request would go out unauthenticated, so stop here instead.
    if (!token) throw new Error("Sign-in did not return an access token.");
    return token;
  }, [getAccessTokenSilently]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-10 text-sm text-muted-foreground">
        <LoadingSpinner label="Signing in" />
        <span>Signing you in…</span>
      </div>
    );
  }

  // A sign-in was started and Auth0 came back without a session, or a token request reported that sign-in is needed.
  const returnedWithoutSession = !isAuthenticated && hasLoginAttempt();
  if (signInNeeded || returnedWithoutSession) {
    return <SignInPrompt onSignIn={() => loginWithRedirect()} />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center gap-3 p-10 text-sm text-muted-foreground">
        <LoadingSpinner label="Redirecting" />
        <span>Redirecting to sign in…</span>
      </div>
    );
  }

  return <AccessTokenContext.Provider value={getAccessToken}>{children}</AccessTokenContext.Provider>;
}

// Custom Auth0 setup for Sitecore Cloud, following the setup in
// https://izharikov.dev/blogs/sitecore-marketplace-app-custom-authorization-setup.
// Mount it only in the browser, after the Marketplace client and application context are ready.
export function CustomAuthProvider({ organizationId, tenantId, children }: CustomAuthProviderProps) {
  const config = useMemo(() => readAuthConfig(), []);

  if (!config) {
    return (
      <p className="p-6 text-sm text-destructive">
        Authentication is not configured. Set the NEXT_PUBLIC_AUTH0_* and NEXT_PUBLIC_SITECORE_APP_ID variables.
      </p>
    );
  }

  // Auth0 only accepts a redirect URI that is registered. The app registers its root URL, and the root page
  // sends the user back to the page they started from.
  const authorizationParams = {
    organization_id: organizationId,
    tenant_id: tenantId,
    product_codes: `mkp_${config.appId}`,
    audience: config.audience,
    redirect_uri: `${config.appBaseUrl}/?redirect=${window.location.pathname}`,
    scope: config.scope,
  };

  return (
    <Auth0Provider
      domain={config.domain}
      clientId={config.clientId}
      authorizationParams={authorizationParams}
      useRefreshTokens
      cacheLocation="memory"
    >
      <AuthenticatedApp>{children}</AuthenticatedApp>
    </Auth0Provider>
  );
}
