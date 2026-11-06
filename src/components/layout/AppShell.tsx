"use client";

import { useState } from "react";
import Image from "next/image";
import { mdiMenu } from "@mdi/js";
import { Button } from "@/src/components/ui/button";
import { ThemeToggle } from "@/src/components/theme/ThemeToggle";
import { FeatureBusyContext } from "@/src/features/busy";
import type { FeatureDefinition, FeatureProps } from "@/src/features/registry";
import { Icon } from "@/src/lib/icon";
import { cn } from "@/src/lib/utils";

interface AppShellProps {
  title: string;
  subtitle: string;
  features: FeatureDefinition[];
  featureProps: FeatureProps;
}

// App layout: a left sidebar with the brand and feature list, a top bar with the sidebar toggle
// and theme switch, and the active feature in the centred content area. Only the active feature
// is mounted, so switching starts that feature fresh. Navigation is locked while a feature runs.
export function AppShell({ title, subtitle, features, featureProps }: AppShellProps) {
  const [activeId, setActiveId] = useState<string | undefined>(features[0]?.id);
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const active = features.find((feature) => feature.id === activeId) ?? features[0];
  const ActiveFeature = active?.component;

  return (
    <FeatureBusyContext.Provider value={setBusy}>
      <div className="flex min-h-screen bg-muted">
        {sidebarOpen && (
          <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border p-4">
              {/* Brand logo from public/logo.png */}
              <Image src="/logo.png" alt="" width={24} height={24} className="size-6 shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
            </div>

            <nav className="flex flex-col gap-1 p-3" aria-label="Features">
              <p className="px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Menu</p>
              {features.map((feature) => {
                const isActive = feature.id === active?.id;
                return (
                  <button
                    key={feature.id}
                    type="button"
                    disabled={busy && !isActive}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setActiveId(feature.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                      "hover:bg-accent disabled:pointer-events-none disabled:opacity-50",
                      isActive ? "bg-accent font-medium text-primary" : "text-foreground",
                    )}
                  >
                    <Icon path={feature.icon} className="size-4 shrink-0" />
                    {feature.label}
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                aria-label={sidebarOpen ? "Hide navigation" : "Show navigation"}
                onClick={() => setSidebarOpen((open) => !open)}
              >
                <Icon path={mdiMenu} className="size-5" />
              </Button>
              <span className="truncate text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{active?.label}</span>
              </span>
            </div>
            <ThemeToggle />
          </header>

          <main className="flex-1 px-4 py-5 md:px-[10%] md:py-6">
            <div className="flex w-full flex-col gap-6">
              {busy && (
                <p className="text-sm text-muted-foreground">
                  A run is in progress. Other features unlock when it finishes.
                </p>
              )}
              {ActiveFeature && <ActiveFeature key={active?.id} {...featureProps} />}
            </div>
          </main>
        </div>
      </div>
    </FeatureBusyContext.Provider>
  );
}
