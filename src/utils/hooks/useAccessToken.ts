"use client";

import { createContext, useContext } from "react";

// Returns an access token for the signed-in user, scoped to the organization and tenant.
export type GetAccessToken = () => Promise<string>;

// Provided by CustomAuthProvider (src/components/auth/CustomAuthProvider.tsx). Null outside that provider.
export const AccessTokenContext = createContext<GetAccessToken | null>(null);

// Use inside CustomAuthProvider only. Calls outside it fail loudly rather than sending requests without a token.
export function useAccessToken(): GetAccessToken {
  const getAccessToken = useContext(AccessTokenContext);
  if (!getAccessToken) throw new Error("useAccessToken must be used inside CustomAuthProvider.");
  return getAccessToken;
}
