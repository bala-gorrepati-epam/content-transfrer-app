import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { GET_ITEMS_WITH_FIELDS } from "@/src/utils/graphqlQueries";
import type { CompareLanguage, FieldNode, FieldsLoad, FieldValues, SideItem } from "@/src/models/contentDiff";
import type { PageInfo } from "@/src/models/getItems";

// An item as GET_ITEMS_WITH_FIELDS returns it. `fields` is null when reading them failed for that item.
interface RawItem {
  itemId: string;
  name: string;
  path: string;
  version: number;
  hasChildren: boolean;
  fields: { nodes: FieldNode[] } | null;
}

interface RawPage {
  item: (RawItem & { children: { nodes: (RawItem | null)[]; pageInfo: PageInfo } | null }) | null;
}

// Shape of one GraphQL error as the SDK types it.
interface GraphqlError {
  message?: string;
  path?: string[];
}

export interface ItemListing {
  item: SideItem;
  children: SideItem[];
}

interface Page {
  item: SideItem | null;
  children: SideItem[];
  nextCursor: string | null;
}

// Field-read errors of one page, keyed by the item they belong to.
interface PageErrors {
  self: string | null;
  children: Map<number, string>;
}

// Errors on a field point at the field: ["item", "fields"] for the item itself, and
// ["item", "children", "nodes", <index>, "fields"] for one of its children. Those are attributed to one
// item. Any other error (for example on the children list itself) cannot be tied to one item, so it fails the read.
function sortErrors(errors: GraphqlError[]): PageErrors {
  const result: PageErrors = { self: null, children: new Map() };
  for (const error of errors) {
    const path = (error.path ?? []) as (string | number)[];
    const message = error.message ?? "Fields could not be read.";

    if (path.length === 2 && path[0] === "item" && path[1] === "fields") {
      result.self ??= message;
    } else if (
      path.length === 5 &&
      path[0] === "item" &&
      path[1] === "children" &&
      path[2] === "nodes" &&
      typeof path[3] === "number" &&
      path[4] === "fields"
    ) {
      if (!result.children.has(path[3])) result.children.set(path[3], message);
    } else {
      throw new Error(message);
    }
  }
  return result;
}

// An item with no version in the language has no field values there. That is an empty result, not a failed read.
function toFieldsLoad(fields: { nodes: FieldNode[] } | null, error: string | undefined, version: number): FieldsLoad {
  if (version === 0) return { ok: true, values: new Map() };
  if (fields) {
    const values: FieldValues = new Map(fields.nodes.map((field) => [field.name, field.value]));
    return { ok: true, values };
  }
  return { ok: false, error: error ?? "Fields could not be read." };
}

// One page of an item and its children, in one language. `item` is null when the path does not exist
// in this environment for that language, which is a valid comparison result.
async function GetItemPage(
  client: ClientSDK,
  contextId: string,
  path: string,
  language: CompareLanguage,
  after?: string,
): Promise<Page> {
  const response = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: {
        sitecoreContextId: contextId,
      },
      body: {
        query: GET_ITEMS_WITH_FIELDS,
        variables: {
          path: path,
          language: language,
          ...(after && { after: after }),
        },
      },
    },
  });

  if ("error" in response && response.error)
    throw new Error("string" == typeof response.error ? response.error : "Retrieving of items failed");

  const body = response?.data;
  const errors: GraphqlError[] = body?.errors ?? [];
  const data = body?.data as RawPage | null | undefined;

  // No data at all means the whole request failed.
  if (!data) throw new Error(errors[0]?.message ?? "GraphQL query failed to retrieve items from the environment");

  const raw = data.item;
  if (!raw) return { item: null, children: [], nextCursor: null };

  const pageErrors = sortErrors(errors);
  const item: SideItem = {
    itemId: raw.itemId,
    name: raw.name,
    path: raw.path,
    version: raw.version,
    hasChildren: raw.hasChildren,
    fields: toFieldsLoad(raw.fields, pageErrors.self ?? undefined, raw.version),
  };

  const rawChildren = raw.children?.nodes ?? [];
  const children: SideItem[] = rawChildren.map((child, index) => {
    // A child that is null (not just its fields) cannot be placed in the tree, so the read fails.
    if (!child) throw new Error("A child item could not be read.");
    return {
      itemId: child.itemId,
      name: child.name,
      path: child.path,
      version: child.version,
      hasChildren: child.hasChildren,
      fields: toFieldsLoad(child.fields, pageErrors.children.get(index), child.version),
    };
  });

  const pageInfo = raw.children?.pageInfo;
  const nextCursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
  return { item, children, nextCursor };
}

// Lists an item and all of its children with their field values in one language, following every page.
// A comparison needs the complete child list on both sides to pair children by path, so this does not stop
// after the first page. Returns null when the item does not exist in this environment.
export async function ListAllChildren(
  client: ClientSDK,
  contextId: string,
  path: string,
  language: CompareLanguage,
): Promise<ItemListing | null> {
  const first = await GetItemPage(client, contextId, path, language);
  if (!first.item) return null;

  const children: SideItem[] = [...first.children];
  const seenCursors = new Set<string>();
  let cursor = first.nextCursor;

  while (cursor) {
    // A repeated cursor would loop forever; stop with an error instead.
    if (seenCursors.has(cursor)) throw new Error("Paging of child items did not advance.");
    seenCursors.add(cursor);

    const page = await GetItemPage(client, contextId, path, language, cursor);
    // The item existed on the first page, so a missing page means it changed while being read.
    if (!page.item) throw new Error("Item disappeared while its children were being read.");
    children.push(...page.children);
    cursor = page.nextCursor;
  }

  return { item: first.item, children };
}
