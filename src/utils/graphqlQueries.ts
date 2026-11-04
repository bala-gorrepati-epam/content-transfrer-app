export const GET_ITEMS= `
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
`