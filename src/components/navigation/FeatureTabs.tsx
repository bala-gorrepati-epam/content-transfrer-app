"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { FeatureBusyContext } from "@/src/features/busy";
import type { FeatureDefinition, FeatureProps } from "@/src/features/registry";

interface FeatureTabsProps {
  features: FeatureDefinition[];
  featureProps: FeatureProps;
}

// One tab per feature. Only the active feature is mounted, so switching tabs starts that tab from a
// fresh state. Tabs are locked while a feature reports a run in progress.
export function FeatureTabs({ features, featureProps }: FeatureTabsProps) {
  const [active, setActive] = useState<string | undefined>(features[0]?.id);
  const [busy, setBusy] = useState(false);

  const current = features.find((feature) => feature.id === active);
  const ActiveFeature = current?.component;

  return (
    <FeatureBusyContext.Provider value={setBusy}>
      <Tabs value={active} onValueChange={(value) => !busy && setActive(value)} className="flex flex-col gap-6">
        <TabsList>
          {features.map((feature) => (
            <TabsTrigger key={feature.id} value={feature.id} disabled={busy && feature.id !== active}>
              {feature.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {busy && (
          <p className="text-sm text-muted-foreground">A run is in progress. Tabs unlock when it finishes.</p>
        )}

        {ActiveFeature && (
          <TabsContent key={active} value={active ?? ""} forceMount>
            <ActiveFeature {...featureProps} />
          </TabsContent>
        )}
      </Tabs>
    </FeatureBusyContext.Provider>
  );
}
