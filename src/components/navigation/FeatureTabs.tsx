"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import type { FeatureDefinition, FeatureProps } from "@/src/features/registry";

interface FeatureTabsProps {
  features: FeatureDefinition[];
  featureProps: FeatureProps;
}

// One tab per feature. Inactive features stay mounted and hidden, so a transfer's tree and
// selection survive switching tabs.
export function FeatureTabs({ features, featureProps }: FeatureTabsProps) {
  const [active, setActive] = useState<string | undefined>(features[0]?.id);

  return (
    <Tabs value={active} onValueChange={setActive} className="flex flex-col gap-6">
      <TabsList>
        {features.map((feature) => (
          <TabsTrigger key={feature.id} value={feature.id}>
            {feature.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {features.map((feature) => {
        const Feature = feature.component;
        return (
          <TabsContent key={feature.id} value={feature.id} forceMount className="data-[state=inactive]:hidden">
            <Feature {...featureProps} />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
