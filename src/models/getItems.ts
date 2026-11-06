export interface Item {
  item: ItemNode & {
    children: {
      nodes: ItemNode[];
      pageInfo: PageInfo;
    };
  };
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
