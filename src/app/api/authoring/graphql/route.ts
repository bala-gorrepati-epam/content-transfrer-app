import { experimental_createXMCClient } from "@sitecore-marketplace-sdk/xmc";
import { NextResponse } from "next/server";
import { GET_ITEMS } from "@/src/utils/graphqlQueries";

// Runs the item-tree query for the browser, with the user's own access token (custom Auth0 setup).
// Only GET_ITEMS is accepted, so this route cannot be used to send arbitrary GraphQL.
// Tokens and context IDs are never logged.
export const runtime = "nodejs";

interface GraphqlRequest {
  sitecoreContextId: string;
  query: string;
  variables?: Record<string, unknown>;
}

function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function isGraphqlRequest(value: unknown): value is GraphqlRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.sitecoreContextId === "string" && typeof body.query === "string";
}

export async function POST(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The request body must be JSON." }, { status: 400 });
  }

  if (!isGraphqlRequest(body) || body.query !== GET_ITEMS) {
    return NextResponse.json({ error: "This query is not allowed." }, { status: 400 });
  }

  try {
    const xmc = await experimental_createXMCClient({ getAccessToken: async () => token });
    const result = await xmc.authoring.graphql({
      query: { sitecoreContextId: body.sitecoreContextId },
      body: { query: body.query, variables: body.variables ?? {} },
    });

    if (result.error) {
      return NextResponse.json({ error: "The authoring API request failed." }, { status: 502 });
    }
    // Same body shape the SDK returned before: { data, errors }. The caller reads it the same way.
    return NextResponse.json(result.data ?? {});
  } catch {
    return NextResponse.json({ error: "The authoring API request failed." }, { status: 502 });
  }
}
