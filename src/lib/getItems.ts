import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
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
// With a token (custom Auth0 setup, see CLAUDE.md) the request goes to our route. Without one (organization admins
// and owners) it goes through the SDK, as before custom auth. Both run the same GET_ITEMS query.
export async function GetItems(
  client: ClientSDK,
  getAccessToken: GetAccessToken | null,
  sourceContextId: string,
  path: string,
  after?: string,
): Promise<Item> {
  const variables = {
    path: path,
    ...(after && { after: after }),
  };

  let responseBody: GraphqlBody & { error?: string };
  if (getAccessToken) {
    const accessToken = await getAccessToken();
    const response = await fetch("/api/authoring/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ sitecoreContextId: sourceContextId, query: GET_ITEMS, variables }),
    });
    responseBody = (await response.json().catch(() => ({}))) as GraphqlBody & { error?: string };
    if (!response.ok) {
      throw new Error(responseBody.error ?? "Retrieving of items failed");
    }
  } else {
    const getItemsResponse = await client.mutate("xmc.authoring.graphql", {
      params: {
        query: {
          sitecoreContextId: sourceContextId,
        },
        body: {
          query: GET_ITEMS,
          variables,
        },
      },
    });

    if ("error" in getItemsResponse && getItemsResponse.error)
      throw new Error(
        "string" == typeof getItemsResponse.error ? getItemsResponse.error : "Retrieving of items failed",
      );

    responseBody = (getItemsResponse?.data ?? {}) as GraphqlBody;
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
