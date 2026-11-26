"use client";

import { LoadingSpinner } from "@/src/components/ui/loading-spinner";

interface PermissionCheckOverlayProps {
  destinationName: string | undefined;
}

// Full-screen layer shown while the destination rights are checked before a transfer or install. It blocks clicks
// until the check finishes. The background is a light tint, so the page stays visible behind the spinner card.
export function PermissionCheckOverlay({ destinationName }: PermissionCheckOverlayProps) {
  return (
    <div aria-busy="true" className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 p-4">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-6 shadow-lg">
        <LoadingSpinner label="Checking destination permissions" className="size-6" />
        <span className="text-sm">Checking the rights needed in {destinationName}…</span>
      </div>
    </div>
  );
}
