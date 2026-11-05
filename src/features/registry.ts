import type { ComponentType } from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { TransferMode, type EnvironmentOption } from "@/src/components/content-transfer/TransferMode";
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
  component: ComponentType<FeatureProps>;
}

// To add a feature: build its component, then add one entry here. Array order is tab order;
// the first entry is shown when the app opens.
export const FEATURES: FeatureDefinition[] = [
  { id: "transfer", label: "Transfer", component: TransferMode },
  { id: "download-package", label: "Download package", component: DownloadPackageMode },
  { id: "install-package", label: "Install package", component: InstallPackageMode },
  { id: "known-issues", label: "Known issues", component: KnownIssuesMode },
];
