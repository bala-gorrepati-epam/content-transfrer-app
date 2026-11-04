"use client";

import { useState, useEffect } from "react";
import type { ApplicationContext } from "@sitecore-marketplace-sdk/client";
import { useMarketplaceClient } from "@/src/utils/hooks/useMarketplaceClient";
import { GET_ITEMS } from '@/src/utils/graphqlQueries'
import { Item } from "@/src/models/getItems";

function ContentTransfer() {
  const { client, error, isInitialized } = useMarketplaceClient();
  const [appContext, setAppContext] = useState<ApplicationContext>();
  const [sourceContext, setSourceContext] = useState<string>("");
  const [destinationContext, setDestinationContext] = useState<string>("");

  const GetItems = async (context: string, path: string, after?: string): Promise<Item> => {
    const getItemsResponse = await client!.mutate("xmc.authoring.graphql", {
      params: {
        query: {
          sitecoreContextId: context,
        },
        body: {
          query: GET_ITEMS,
          variables: {
            path: path,
            ...(after && { after: after })
          }
        },
      },
    });

    if ("error" in getItemsResponse && getItemsResponse.error)
      throw new Error("string" == typeof getItemsResponse.error ? getItemsResponse.error : "Retriving of items failed");
    
    const getItemsResponseData = getItemsResponse?.data;

    if (getItemsResponseData?.errors?.length) {
      throw new Error(getItemsResponseData.errors.map(i => i.message).join("; "));
    }

    if (!getItemsResponseData?.data) {
      throw new Error("GraphQL mutation failed to retrived data from source");
    }

    return getItemsResponseData.data.item as Item;
  };

  useEffect(() => {
    if (!error && isInitialized && client) {
      client.query("application.context")
        .then((res) => {
          console.log("Success retrieving application.context:", res.data);
          setAppContext(res.data);
        })
        .catch((error) => {
          console.error("Error retrieving application.context:", error);
        });
    } else if (error) {
      console.error("Error initializing Marketplace client:", error);
    }
  }, [client, error, isInitialized]);

  useEffect(() => { 
    if (!appContext) {
      return
    }
    setSourceContext(appContext?.resourceAccess?.[0].context.preview || "");
    setDestinationContext(appContext?.resourceAccess?.[0].context.preview || "");
  }, [appContext]) // Should be dynamically set based on selected source

  return (
    <>
      <p>Hello</p>
      {isInitialized && (
        <>
          {appContext && (
            <>
              <h1>Welcome to {appContext?.name}</h1>
              <p>This is a Content Transfter App.</p>
              <div className="application-context">
                <h3>Application Context:</h3>
                <ul className="context-details">
                  <li><strong>Name:</strong> {appContext.name}</li>
                  <li><strong>ID:</strong> {appContext?.id}</li>
                  <li><strong>Icon URL:</strong> {appContext?.iconUrl}</li>
                  <li><strong>Installation ID:</strong> {appContext?.installationId}</li>
                  <li><strong>State:</strong> {appContext?.state}</li>
                  <li><strong>Type:</strong> {appContext?.type}</li>
                  <li><strong>URL:</strong> {appContext?.url}</li>
                  <button onClick={() => GetItems(sourceContext, '/sitecore')}>Load Items</button>
                </ul>
              </div>
            </>
          )}
        </>
      )}
      {error && <p style={{ color: "red" }}>Error: {String(error)}</p>}
    </>
  );
}

export default ContentTransfer;
