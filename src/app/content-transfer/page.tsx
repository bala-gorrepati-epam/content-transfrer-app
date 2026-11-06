"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApplicationContext } from "@sitecore-marketplace-sdk/client";
import { useMarketplaceClient } from "@/src/utils/hooks/useMarketplaceClient";
import type { EnvironmentOption } from "@/src/models/contentTransfer";
import { FEATURES } from "@/src/features/registry";
import { AppShell } from "@/src/components/layout/AppShell";

function ContentTransfer() {
  const { client, error, isInitialized } = useMarketplaceClient();
  const [appContext, setAppContext] = useState<ApplicationContext>();

  useEffect(() => {
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
    <AppShell
      title="Content Transfer App"
      subtitle="SitecoreAI to SitecoreAI"
      features={FEATURES}
      featureProps={{ client, environments }}
    />
  );
}

export default ContentTransfer;
