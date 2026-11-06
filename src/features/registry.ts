import type { ComponentType } from "react";
import { mdiBookOpenVariant, mdiTrayArrowDown, mdiTrayArrowUp, mdiSwapHorizontal } from "@mdi/js";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { TransferMode } from "@/src/components/content-transfer/TransferMode";
import type { EnvironmentOption } from "@/src/models/contentTransfer";
import { DownloadPackageMode } from "@/src/components/content-transfer/DownloadPackageMode";
import { InstallPackageMode } from "@/src/components/content-transfer/InstallPackageMode";
import { KnownIssuesMode } from "@/src/components/known-issues/KnownIssuesMode";

// Everything a feature may use. Features get the shared client and environment list from the
// page; they must not create their own client.
export interface FeatureProps {
  client: ClientSDK;
  environments: EnvironmentOption[];
}

export interface FeatureDefinition {
  id: string;
  label: string;
  // Blok (MDI) icon path shown in the navigation.
  icon: string;
  component: ComponentType<FeatureProps>;
}

// To add a feature: build its component, then add one entry here. Array order is tab order;
// the first entry is shown when the app opens.
export const FEATURES: FeatureDefinition[] = [
  { id: "transfer", label: "Transfer", icon: mdiSwapHorizontal, component: TransferMode },
  { id: "download-package", label: "Package designer", icon: mdiTrayArrowDown, component: DownloadPackageMode },
  { id: "install-package", label: "Install package", icon: mdiTrayArrowUp, component: InstallPackageMode },
  { id: "known-issues", label: "Known issues", icon: mdiBookOpenVariant, component: KnownIssuesMode },
];
