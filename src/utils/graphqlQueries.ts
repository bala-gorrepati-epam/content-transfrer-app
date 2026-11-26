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

// Reads the access rights of several items in one request, for the Install package destination check.
// Each path is an aliased item `a<n>`, with the path in variable `p<n>`. A missing item comes back as null.
// Built on the server (see the authoring route), so only paths are accepted from the browser, never GraphQL text.
export function buildAccessCheckQuery(count: number): string {
  const variables = Array.from({ length: count }, (_, i) => `$p${i}: String!`).join(", ");
  const items = Array.from(
    { length: count },
    (_, i) => `
    a${i}: item(where: { path: $p${i}, database: "master" }) {
      itemId
      path
      access {
        canRead
        canCreate
        canWrite
      }
    }`,
  ).join("");
  return `
  query CheckItemAccess(${variables}) {${items}
  }
`;
}

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
