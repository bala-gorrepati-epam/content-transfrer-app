"use client";

import { createContext, useContext } from "react";

// Returns an access token for the signed-in user, scoped to the organization and tenant.
export type GetAccessToken = () => Promise<string>;

// Provided by CustomAuthProvider (src/components/auth/CustomAuthProvider.tsx). Null when no custom auth is set up:
// organization admins and owners do not use it, so their item reads go through the SDK.
export const AccessTokenContext = createContext<GetAccessToken | null>(null);

// The token getter, or null when custom auth is not in use. Callers that need a token must handle null.
export function useAccessToken(): GetAccessToken | null {
  return useContext(AccessTokenContext);
}
