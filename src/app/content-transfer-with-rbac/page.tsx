"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApplicationContext } from "@sitecore-marketplace-sdk/client";
import { useMarketplaceClient } from "@/src/utils/hooks/useMarketplaceClient";
import type { EnvironmentOption } from "@/src/models/contentTransfer";
import { FEATURES } from "@/src/features/registry";
import { AppShell } from "@/src/components/layout/AppShell";
import { canUseTenant, hasFullAccess, readRoles } from "@/src/lib/access";
import { CustomAuthProvider } from "@/src/components/auth/CustomAuthProvider";

function ContentTransferWithRbac() {
  const { client, error, isInitialized } = useMarketplaceClient();
  const [appContext, setAppContext] = useState<ApplicationContext>();
  // The user's roles. Null until host.user has answered.
  const [roles, setRoles] = useState<string[] | null>(null);
  const [rolesFailed, setRolesFailed] = useState(false);

  useEffect(() => {
    if (error) {
      console.error("Error initializing Marketplace client:", error);
      return;
    }
    if (!isInitialized || !client) return;

    // Logs nothing from the responses: they contain context IDs and user details.
    client
      .query("application.context")
      .then((res) => setAppContext(res.data))
      .catch((err) => console.error("Error retrieving application context:", err));

    client
      .query("host.user")
      .then((res) => setRoles(readRoles(res.data ?? {})))
      .catch((err) => {
        console.error("Error retrieving user roles:", err);
        setRolesFailed(true);
      });
  }, [client, error, isInitialized]);

  // Environments this user may use. Organization admins and owners get all of them. Everyone else gets the
  // environments whose tenant they hold an XMCloud User or Advance User role for. Features only receive this
  // list, so the source, target and destination dropdowns all follow the same rule.
  // Display name falls back to a generic label; never the context ID.
  const environments: EnvironmentOption[] = useMemo(() => {
    if (!appContext || !roles) return [];
    const fullAccess = hasFullAccess(roles);
    return (appContext.resourceAccess ?? []).flatMap((access, index) => {
      if (!fullAccess && !canUseTenant(roles, access.tenantId)) return [];
      return [
        {
          contextId: access.context.preview,
          name: access.tenantDisplayName ?? `Environment ${index + 1}`,
        },
      ];
    });
  }, [appContext, roles]);

  if (error) {
    return <p className="p-6 text-sm text-destructive">Could not connect to Sitecore: {error.message}</p>;
  }

  // Fails closed: without the roles, nothing is shown rather than every environment.
  if (rolesFailed) {
    return (
      <p className="p-6 text-sm text-destructive">Could not load your access rights. Reload the app to try again.</p>
    );
  }

  if (!client || !isInitialized || !appContext || !roles) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  if (environments.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have access to any environment in this app. Ask your administrator for an XMCloud User or Advance
        User role on the environment you need.
      </p>
    );
  }

  const shell = (
    <AppShell
      title="Content Transfer App"
      subtitle="SitecoreAI to SitecoreAI"
      features={FEATURES}
      featureProps={{ client, environments }}
    />
  );

  // Organization admins and owners do not need custom auth, so no sign-in and no token requests are made for them.
  // Everyone else gets the custom auth provider, which gives features an access token scoped to the organization
  // and tenant from the application context.
  if (hasFullAccess(roles)) return shell;

  return (
    <CustomAuthProvider organizationId={appContext.organizationId} tenantId={appContext.marketplaceAppTenantId}>
      {shell}
    </CustomAuthProvider>
  );
}

export default ContentTransferWithRbac;
