export const GET_ITEMS = `
  query GetItemChildren($path: String!, $after: String) {
    item(where: { path: $path, database: "master" }) {
      itemId
      name
      path
      hasChildren
      children(first: 100, after: $after) {
        nodes {
          itemId
          name
          path
          hasChildren
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export const GET_ITEMS_WITH_FIELDS = `
  query GetItemChildren($path: String!, $after: String, $language: String! = "en") {
    item(where: { path: $path, database: "master", language: $language }) {
      itemId
      name
      path
      version
      hasChildren
      fields(excludeStandardFields: true) {
        nodes {
          name
          value
        }
      }
      children(first: 100, after: $after) {
        nodes {
          itemId
          name
          path
          version
          hasChildren
          fields(excludeStandardFields: true) {
            nodes {
              name
              value
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;
