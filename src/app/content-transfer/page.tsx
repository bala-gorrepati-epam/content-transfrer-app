"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApplicationContext } from "@sitecore-marketplace-sdk/client";
import { useMarketplaceClient } from "@/src/utils/hooks/useMarketplaceClient";
import type { EnvironmentOption } from "@/src/models/contentTransfer";
import { FEATURES } from "@/src/features/registry";
import { FeatureTabs } from "@/src/components/navigation/FeatureTabs";
import { ThemeToggle } from "@/src/components/theme/ThemeToggle";

function ContentTransfer() {
  const { client, error, isInitialized } = useMarketplaceClient();
  const [appContext, setAppContext] = useState<ApplicationContext>();

  useEffect(() => {
    console.log("Inside use effect")
    if (error) {
      console.error("Error initializing Marketplace client:", error);
      return;
    }
    if (!isInitialized || !client) return;

    // Logs nothing from the response: it contains context IDs.
    client
      .query("application.context")
      .then((res) => setAppContext(res.data))
      .catch((err) => console.error("Error retrieving application context:", err));
  }, [client, error, isInitialized]);

  // Display name falls back to a generic label; never the context ID.
  const environments: EnvironmentOption[] = useMemo(
    () =>
      (appContext?.resourceAccess ?? []).map((access, index) => ({
        contextId: access.context.preview,
        name: access.tenantDisplayName ?? `Environment ${index + 1}`,
      })),
    [appContext],
  );

  if (error) {
    return <p className="p-6 text-sm text-destructive">Could not connect to Sitecore: {error.message}</p>;
  }

  if (!client || !isInitialized || !appContext) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <main className="min-h-screen bg-muted"><div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Content transfer</h1>
        <ThemeToggle />
      </div>
      <FeatureTabs features={FEATURES} featureProps={{ client, environments }} />
    </div></main>
  );
}

export default ContentTransfer;
