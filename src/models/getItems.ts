export interface Item {
  item: ItemNode & {
    children: {
      nodes: ItemNode[];
      pageInfo: PageInfo;
    };
  };
}

// What the signed-in user may do with an item. Read by the batched access check (Install package) only.
export interface ItemAccess {
  canRead: boolean;
  canCreate: boolean;
  canWrite: boolean;
}

export interface ItemNode {
  itemId: string;
  hasChildren: boolean;
  name: string;
  path: string;
}

export interface PageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}
