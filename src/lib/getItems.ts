import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { GET_ITEMS } from "@/src/utils/graphqlQueries";
import type { Item } from "@/src/models/getItems";

// Returns the item at `path` with its children (max 100 per call).
// `after` is the endCursor of the previous page; omit it for the first page.
// The client is passed in so this module never creates a second one.
export async function GetItems(
  client: ClientSDK,
  sourceContextId: string,
  path: string,
  after?: string,
): Promise<Item> {
  const getItemsResponse = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: {
        sitecoreContextId: sourceContextId,
      },
      body: {
        query: GET_ITEMS,
        variables: {
          path: path,
          ...(after && { after: after }),
        },
      },
    },
  });

  if ("error" in getItemsResponse && getItemsResponse.error)
    throw new Error("string" == typeof getItemsResponse.error ? getItemsResponse.error : "Retrieving of items failed");

  const getItemsResponseData = getItemsResponse?.data;

  if (getItemsResponseData?.errors?.length) {
    throw new Error(getItemsResponseData.errors.map((i) => i.message).join("; "));
  }

  if (!getItemsResponseData?.data) {
    throw new Error("GraphQL query failed to retrieve data from source");
  }

  // The SDK types the GraphQL body loosely (`{ [key]: unknown }`), so the cast goes through unknown.
  return getItemsResponseData.data as unknown as Item;
}
