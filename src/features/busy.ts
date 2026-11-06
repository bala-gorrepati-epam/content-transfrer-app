"use client";

import { createContext, useContext, useEffect } from "react";

// Lets a feature tell the tab bar that a run is in progress. While busy, tabs are locked, because
// switching tabs would unmount the feature and lose track of the run.
export const FeatureBusyContext = createContext<(busy: boolean) => void>(() => {});

export function useReportBusy(busy: boolean) {
  const report = useContext(FeatureBusyContext);
  useEffect(() => {
    report(busy);
  }, [busy, report]);
  // If the feature unmounts during a run, release the lock.
  useEffect(() => () => report(false), [report]);
}
