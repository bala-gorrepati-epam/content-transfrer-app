"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { ListAllChildren } from "@/src/lib/listAllChildren";
import { pairChildren } from "@/src/lib/contentDiff";
import type { CompareLanguage, SideItem } from "@/src/models/contentDiff";

export const COMPARE_ROOT_PATH = "/sitecore";

// Which environments to query for a node. An item that is missing on one side has no children there,
// so that side is not queried.
interface Sides {
  source: boolean;
  target: boolean;
}

const BOTH_SIDES: Sides = { source: true, target: true };

// A child of the loaded node, with its state on each side.
interface SidePair {
  path: string;
  source: SideItem | null;
  target: SideItem | null;
}

export interface DiffNodeState {
  path: string;
  name: string;
  source: SideItem | null; // null when the item is missing on the source side
  target: SideItem | null; // null when the item is missing on the target side
  childPaths: string[]; // children from the last successful load, in display order
  expanded: boolean;
  load: "idle" | "loading" | "loaded" | "error";
  error?: string;
  requestId: number; // only the latest request for a node may apply its response
}

interface DiffTreeState {
  epoch: number; // bumped on every comparison change; responses from older epochs are ignored
  nodes: Record<string, DiffNodeState>;
}

type Action =
  | { type: "reset"; epoch: number }
  | { type: "loadStart"; epoch: number; path: string; requestId: number }
  | {
      type: "loadSuccess";
      epoch: number;
      path: string;
      requestId: number;
      source: SideItem | null;
      target: SideItem | null;
      children: SidePair[];
    }
  | { type: "loadError"; epoch: number; path: string; requestId: number; error: string }
  | { type: "setExpanded"; path: string; expanded: boolean }
  // Refresh of a node: every node below it collapses and drops its cached children, so they load again when
  // expanded. Their requestId is replaced so any response still in flight for them is ignored.
  | { type: "collapseBelow"; epoch: number; path: string; invalidateId: number };

function nameOf(path: string, source: SideItem | null, target: SideItem | null): string {
  return source?.name ?? target?.name ?? path.split("/").filter(Boolean).pop() ?? path;
}

function emptyNode(path: string): DiffNodeState {
  return {
    path,
    name: nameOf(path, null, null),
    source: null,
    target: null,
    childPaths: [],
    // The root is shown open; every other node starts collapsed.
    expanded: path === COMPARE_ROOT_PATH,
    load: "idle",
    requestId: 0,
  };
}

function isCurrent(state: DiffTreeState, epoch: number, path: string, requestId: number) {
  return state.epoch === epoch && state.nodes[path]?.requestId === requestId;
}

function reducer(state: DiffTreeState, action: Action): DiffTreeState {
  switch (action.type) {
    case "reset":
      return { epoch: action.epoch, nodes: {} };

    case "loadStart": {
      if (state.epoch !== action.epoch) return state;
      const prev = state.nodes[action.path] ?? emptyNode(action.path);
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [action.path]: { ...prev, load: "loading", error: undefined, requestId: action.requestId },
        },
      };
    }

    case "loadSuccess": {
      if (!isCurrent(state, action.epoch, action.path, action.requestId)) return state;
      const nodes = { ...state.nodes };
      const prev = nodes[action.path] ?? emptyNode(action.path);

      nodes[action.path] = {
        ...prev,
        name: nameOf(action.path, action.source, action.target),
        source: action.source,
        target: action.target,
        childPaths: action.children.map((child) => child.path),
        load: "loaded",
        error: undefined,
      };

      // Children already known keep their own expansion and loaded children; only their sides refresh.
      for (const child of action.children) {
        const existing = nodes[child.path] ?? emptyNode(child.path);
        nodes[child.path] = {
          ...existing,
          name: nameOf(child.path, child.source, child.target),
          source: child.source,
          target: child.target,
        };
      }
      return { ...state, nodes };
    }

    case "loadError": {
      if (!isCurrent(state, action.epoch, action.path, action.requestId)) return state;
      const prev = state.nodes[action.path] ?? emptyNode(action.path);
      return {
        ...state,
        nodes: { ...state.nodes, [action.path]: { ...prev, load: "error", error: action.error } },
      };
    }

    case "setExpanded": {
      const prev = state.nodes[action.path];
      if (!prev) return state;
      return { ...state, nodes: { ...state.nodes, [action.path]: { ...prev, expanded: action.expanded } } };
    }

    case "collapseBelow": {
      if (state.epoch !== action.epoch) return state;
      const root = state.nodes[action.path];
      if (!root) return state;
      const nodes = { ...state.nodes };
      const pending = [...root.childPaths];
      const seen = new Set<string>();
      while (pending.length > 0) {
        const path = pending.pop();
        if (path === undefined || seen.has(path)) continue;
        seen.add(path);
        const node = nodes[path];
        if (!node) continue;
        pending.push(...node.childPaths);
        nodes[path] = {
          ...node,
          expanded: false,
          load: "idle",
          error: undefined,
          childPaths: [],
          requestId: action.invalidateId,
        };
      }
      // The refreshed node stays open, so its fresh children are what the user sees.
      nodes[action.path] = { ...root, expanded: true };
      return { ...state, nodes };
    }
  }
}

// Which environments a node's children must be read from. The root's existence is not known yet, so both
// sides are read. Any other node is known to exist on the sides where it is listed.
function sidesOf(node: DiffNodeState): Sides {
  if (node.path === COMPARE_ROOT_PATH) return BOTH_SIDES;
  return { source: node.source !== null, target: node.target !== null };
}

// Compares the item tree of two environments in one language, lazily. A node's children are loaded the first
// time it expands, and cached after that. Refresh reloads one node. Changing an environment or the language
// resets the comparison, because cached field values belong to the old choice.
export function useContentDiff(
  client: ClientSDK | null,
  sourceContextId: string | null,
  targetContextId: string | null,
  language: CompareLanguage,
) {
  const [state, dispatch] = useReducer(reducer, { epoch: 0, nodes: {} });
  const epochRef = useRef(0);
  const requestCounter = useRef(0);

  const comparable = Boolean(client && sourceContextId && targetContextId && sourceContextId !== targetContextId);

  const loadNode = useCallback(
    async (path: string, sides: Sides) => {
      if (!client || !sourceContextId || !targetContextId || !comparable) return;
      const epoch = epochRef.current;
      const requestId = ++requestCounter.current;
      dispatch({ type: "loadStart", epoch, path, requestId });
      try {
        // A side that is not queried has no item and no children, so it stays null.
        const [sourceListing, targetListing] = await Promise.all([
          sides.source ? ListAllChildren(client, sourceContextId, path, language) : Promise.resolve(null),
          sides.target ? ListAllChildren(client, targetContextId, path, language) : Promise.resolve(null),
        ]);

        dispatch({
          type: "loadSuccess",
          epoch,
          path,
          requestId,
          source: sourceListing?.item ?? null,
          target: targetListing?.item ?? null,
          children: pairChildren(sourceListing?.children ?? [], targetListing?.children ?? []),
        });
      } catch (e) {
        dispatch({
          type: "loadError",
          epoch,
          path,
          requestId,
          error: e instanceof Error ? e.message : "Failed to load items.",
        });
      }
    },
    [client, sourceContextId, targetContextId, comparable, language],
  );

  // Environments or language changed (or the client became ready): drop the old comparison and load the root.
  useEffect(() => {
    epochRef.current += 1;
    dispatch({ type: "reset", epoch: epochRef.current });
    void loadNode(COMPARE_ROOT_PATH, BOTH_SIDES);
  }, [loadNode]);

  // Expanding loads children only the first time; later toggles use the cache.
  const toggle = useCallback(
    (node: DiffNodeState) => {
      const expanded = !node.expanded;
      dispatch({ type: "setExpanded", path: node.path, expanded });
      if (expanded && node.load === "idle") void loadNode(node.path, sidesOf(node));
    },
    [loadNode],
  );

  // Reloads this node's item and children from the environments, and collapses everything below it.
  // Used by Retry and by Refresh.
  const refresh = useCallback(
    (node: DiffNodeState) => {
      dispatch({
        type: "collapseBelow",
        epoch: epochRef.current,
        path: node.path,
        invalidateId: ++requestCounter.current,
      });
      void loadNode(node.path, sidesOf(node));
    },
    [loadNode],
  );

  return { nodes: state.nodes, comparable, toggle, retry: refresh, refresh };
}
