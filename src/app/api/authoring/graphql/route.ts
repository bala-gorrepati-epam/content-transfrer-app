import { experimental_createXMCClient } from "@sitecore-marketplace-sdk/xmc";
import { NextResponse } from "next/server";
import { GET_ITEMS, buildAccessCheckQuery } from "@/src/utils/graphqlQueries";

// Runs the authoring queries the app needs, with the user's own access token (custom Auth0 setup).
// Only two requests are accepted, so this route cannot be used to send arbitrary GraphQL:
// - the item-tree query (GET_ITEMS), and
// - an access check for a list of item paths (the query text is built here, from the paths only).
// Tokens and context IDs are never logged.
export const runtime = "nodejs";

// Upper limit for one access check. Each path is one aliased item in the query.
const MAX_ACCESS_PATHS = 1000;

interface GraphqlRequest {
  sitecoreContextId: string;
  query: string;
  variables?: Record<string, unknown>;
}

interface AccessCheckRequest {
  sitecoreContextId: string;
  accessPaths: string[];
}

function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function isGraphqlRequest(value: unknown): value is GraphqlRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.sitecoreContextId === "string" && typeof body.query === "string" && body.query === GET_ITEMS;
}

function isAccessCheckRequest(value: unknown): value is AccessCheckRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.sitecoreContextId === "string" &&
    Array.isArray(body.accessPaths) &&
    body.accessPaths.length > 0 &&
    body.accessPaths.length <= MAX_ACCESS_PATHS &&
    body.accessPaths.every((path) => typeof path === "string" && path.startsWith("/") && path.length <= 2048)
  );
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

  let sitecoreContextId: string;
  let query: string;
  let variables: Record<string, unknown>;

  if (isGraphqlRequest(body)) {
    sitecoreContextId = body.sitecoreContextId;
    query = body.query;
    variables = body.variables ?? {};
  } else if (isAccessCheckRequest(body)) {
    sitecoreContextId = body.sitecoreContextId;
    query = buildAccessCheckQuery(body.accessPaths.length);
    variables = Object.fromEntries(body.accessPaths.map((path, index) => [`p${index}`, path]));
  } else {
    return NextResponse.json({ error: "This query is not allowed." }, { status: 400 });
  }

  try {
    const xmc = await experimental_createXMCClient({ getAccessToken: async () => token });
    const result = await xmc.authoring.graphql({
      query: { sitecoreContextId },
      body: { query, variables },
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
