import type { GetAccessToken } from "@/src/utils/hooks/useAccessToken";
import { GET_ITEMS } from "@/src/utils/graphqlQueries";
import type { Item } from "@/src/models/getItems";

// The body the authoring route returns: the GraphQL result, as the authoring API sent it.
interface GraphqlBody {
  data?: { [key: string]: unknown };
  errors?: Array<{ message?: string }>;
}

// Returns the item at `path` with its children (max 100 per call).
// `after` is the endCursor of the previous page; omit it for the first page.
// The request goes to our own route with the user's access token (custom Auth0 setup, see CLAUDE.md).
// The route runs the same GET_ITEMS query against the source environment.
export async function GetItems(
  getAccessToken: GetAccessToken,
  sourceContextId: string,
  path: string,
  after?: string,
): Promise<Item> {
  const accessToken = await getAccessToken();

  const response = await fetch("/api/authoring/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      sitecoreContextId: sourceContextId,
      query: GET_ITEMS,
      variables: {
        path: path,
        ...(after && { after: after }),
      },
    }),
  });

  const responseBody = (await response.json().catch(() => ({}))) as GraphqlBody & { error?: string };

  if (!response.ok) {
    throw new Error(responseBody.error ?? "Retrieving of items failed");
  }

  if (responseBody.errors?.length) {
    throw new Error(responseBody.errors.map((i) => i.message).join("; "));
  }

  if (!responseBody.data) {
    throw new Error("GraphQL query failed to retrieve data from source");
  }

  // The GraphQL body is typed loosely, so the cast goes through unknown.
  return responseBody.data as unknown as Item;
}
