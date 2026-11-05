"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { GetItems } from "@/src/lib/getItems";
import type { Item, ItemNode, PageInfo } from "@/src/models/getItems";

export const ROOT_PATH = "/sitecore";

export interface TreeNodeState {
  path: string;
  item: ItemNode | null; // null until this node's own details have loaded
  childPaths: string[]; // ordered cache of loaded children; never refetched on collapse/expand
  pageInfo: PageInfo | null; // from the last children response
  expanded: boolean;
  load: "idle" | "loading" | "loaded" | "error";
  error?: string;
  failedAfter?: string; // cursor of the page that failed, so retry asks for the same page
  requestId: number; // only the latest request for a node may apply its response
}

interface SourceTreeState {
  epoch: number; // bumped on every source change; responses from older epochs are ignored
  nodes: Record<string, TreeNodeState>;
}

type Action =
  | { type: "reset"; epoch: number }
  | { type: "loadStart"; epoch: number; path: string; requestId: number }
  | {
      type: "loadSuccess";
      epoch: number;
      path: string;
      requestId: number;
      result: Item;
      append: boolean;
    }
  | {
      type: "loadError";
      epoch: number;
      path: string;
      requestId: number;
      error: string;
      after?: string;
    }
  | { type: "setExpanded"; path: string; expanded: boolean };

function emptyNode(path: string): TreeNodeState {
  return {
    path,
    item: null,
    childPaths: [],
    pageInfo: null,
    // The root is shown open; every other node starts collapsed.
    expanded: path === ROOT_PATH,
    load: "idle",
    requestId: 0,
  };
}

function isCurrent(state: SourceTreeState, epoch: number, path: string, requestId: number) {
  return state.epoch === epoch && state.nodes[path]?.requestId === requestId;
}

function reducer(state: SourceTreeState, action: Action): SourceTreeState {
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
          [action.path]: {
            ...prev,
            load: "loading",
            error: undefined,
            failedAfter: undefined,
            requestId: action.requestId,
          },
        },
      };
    }

    case "loadSuccess": {
      if (!isCurrent(state, action.epoch, action.path, action.requestId)) return state;
      const nodes = { ...state.nodes };
      const prev = nodes[action.path] ?? emptyNode(action.path);
      const node = action.result.item;

      // Append keeps already-loaded children; a first page replaces them.
      const childPaths = action.append ? [...prev.childPaths] : [];
      const known = new Set(childPaths);
      for (const child of node.children.nodes) {
        // Dedupe: a page can repeat items if the list changed between requests.
        if (!known.has(child.path)) {
          childPaths.push(child.path);
          known.add(child.path);
        }
        const existing = nodes[child.path] ?? emptyNode(child.path);
        nodes[child.path] = { ...existing, item: child };
      }

      nodes[action.path] = {
        ...prev,
        item: {
          itemId: node.itemId,
          name: node.name,
          path: node.path,
          hasChildren: node.hasChildren,
        },
        childPaths,
        pageInfo: node.children.pageInfo,
        load: "loaded",
        error: undefined,
        failedAfter: undefined,
      };
      return { ...state, nodes };
    }

    case "loadError": {
      if (!isCurrent(state, action.epoch, action.path, action.requestId)) return state;
      const prev = state.nodes[action.path] ?? emptyNode(action.path);
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [action.path]: {
            ...prev,
            load: "error",
            error: action.error,
            failedAfter: action.after,
          },
        },
      };
    }

    case "setExpanded": {
      const prev = state.nodes[action.path];
      if (!prev) return state;
      return {
        ...state,
        nodes: { ...state.nodes, [action.path]: { ...prev, expanded: action.expanded } },
      };
    }
  }
}

// Lazy-loading tree for one source environment. Pass the source context ID from state;
// changing it resets the tree and reloads the root.
export function useSourceTree(client: ClientSDK | null, sourceContextId: string | null) {
  const [state, dispatch] = useReducer(reducer, { epoch: 0, nodes: {} });
  const epochRef = useRef(0);
  const requestCounter = useRef(0);

  const loadNode = useCallback(
    async (path: string, after?: string) => {
      if (!client || !sourceContextId) return;
      const epoch = epochRef.current;
      const requestId = ++requestCounter.current;
      dispatch({ type: "loadStart", epoch, path, requestId });
      try {
        const result = await GetItems(client, sourceContextId, path, after);
        if (!result?.item) throw new Error("No item exists at this path in the source environment.");
        dispatch({ type: "loadSuccess", epoch, path, requestId, result, append: Boolean(after) });
      } catch (e) {
        dispatch({
          type: "loadError",
          epoch,
          path,
          requestId,
          error: e instanceof Error ? e.message : "Failed to load items.",
          after,
        });
      }
    },
    [client, sourceContextId],
  );

  // Source changed (or client became ready): drop the old tree, then load the root and its first page.
  useEffect(() => {
    epochRef.current += 1;
    dispatch({ type: "reset", epoch: epochRef.current });
    void loadNode(ROOT_PATH);
  }, [loadNode]);

  // Expanding loads children only the first time; later toggles use the cache.
  const toggle = useCallback(
    (node: TreeNodeState) => {
      const expanded = !node.expanded;
      dispatch({ type: "setExpanded", path: node.path, expanded });
      if (expanded && node.load === "idle") void loadNode(node.path);
    },
    [loadNode],
  );

  const loadMore = useCallback(
    (node: TreeNodeState) => {
      const cursor = node.pageInfo?.endCursor;
      if (!node.pageInfo?.hasNextPage || !cursor || node.load === "loading") return;
      void loadNode(node.path, cursor);
    },
    [loadNode],
  );

  const retry = useCallback(
    (node: TreeNodeState) => {
      void loadNode(node.path, node.failedAfter);
    },
    [loadNode],
  );

  return { nodes: state.nodes, toggle, loadMore, retry };
}
