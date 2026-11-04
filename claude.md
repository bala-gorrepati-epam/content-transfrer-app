# Project
Next.js 16.1 (App Router, TypeScript strict) SitecoreAI Marketplace standalone app.
Purpose: copy content items from one SitecoreAI environment to another.
- App URL in registration: `/content-transfer`
- Entry point: `src/app/content-transfer/page.tsx`

# SDK Usage
- For content transfer operations (createContentTransfer to deleteContentTransfer), use the `content-transfer-sdk` skill before writing the call. When something marked UNVERIFIED in the skill is confirmed on a real run, update the skill.
- Client comes from the `useMarketplaceClient` hook (`src/utils/hooks/useMarketplaceClient`). Never create a second client.
- `client.application.context` is stored in `appContext` state.
  `appContext.resourceAccess[]` lists the environments the app can access.
  Use `resourceAccess[i].context.preview` as the context ID for xmc calls.
  Use `appContext.resourceAccess[i].tenantDisplayName` as the display name for environment
- Authentication is handled by the client. Call `client.mutate("<operation>", params)`
  (or `client.query` for queries; confirm which in the skill). Do not add your own auth.

# Feature: content transfer
Full flow and rules: @docs/content-transfer-flow.md
s
Three modes in /content-transfer:
1. Transfer: pick source + destination (must differ; label environments by name, never by context ID)
    -> browse the source tree (see Source tree browsing below) -> multi-select items
    -> set Scope and MergeStrategy per item -> run transfer -> show per-step progress.
2. Download package: same selection as Transfer, source only -> export, bundle as .zip, download.
3. Install package: upload our .zip, pick destination, confirm, install.

## Source tree browsing
Items are fetched with the `GetItems` function in `src/app/content-transfer/page.tsx`
(move it to its own file, e.g. `src/lib/getItems.ts`, if page.tsx grows). It calls
`client.mutate("xmc.authoring.graphql", ...)` with the `GET_ITEMS` query and variables
`path` and optional `after`, and returns the item at `path` plus its children.

- `GetItems` takes the context ID of the selected SOURCE environment as a parameter.
  Never hard-code `resourceAccess[0]`.
- Keep the existing error handling: throw on `error`, on GraphQL `errors`, and when `data` is missing.

Tree behavior:
- Root path: `/sitecore`. When the source is selected, load the root item
  and its first page of children.
- Lazy loading: load a node's children only when the user expands it, by calling
  `GetItems(node.path, sourceContextId)`. Never load the whole tree up front.
  Only show an expand control when `hasChildren` is true.
- Pagination: one call returns at most 100 children. When `pageInfo.hasNextPage` is true, show a
  "Load more" row under that node. Clicking it calls `GetItems(node.path, sourceContextId, pageInfo.endCursor)`,
  appends the new nodes to that node's existing children (no duplicates), and stores the new
  `endCursor` and `hasNextPage` for that node. Do not auto-load all pages.
- Cache loaded children per node path. Do not refetch on collapse and expand.
- Each node has its own loading and error state. A failed node shows the error with a retry action and must not break the rest of the tree.
- When the source environment changes, clear the tree and the selection. Ignore any response that arrives after that (stale responses).
- The existing `Item` types need fixing: `hasNextPage` must be `boolean`, and the return type of `GetItems` must match the real response (check one real response; the current `Item` has an extra `item` level).

Selection:
- Multi-select with checkboxes. Store selections by `path` (plus `name` for display) so they survive collapsing and expanding.
- Scope (`SingleItem` | `ItemAndDescendants`) and MergeStrategy (`OverrideExistingItem` | `KeepExistingItem` | `LatestWin` | `OverrideExistingTree`) are set per selected item. Defaults for new selections: `SingleItem` and `OverrideExistingItem`.
- Avoid overlapping dataTrees: if an item is selected with `ItemAndDescendants`, its descendants are already covered. Show them as covered, and drop any separate selections of them.
- The selected list shows each item's path, scope and mergeStrategy, and these become the `dataTrees` of `createContentTransfer`.

# Code style
- 2-space indentation, named exports for React components.
- GraphQL queries live in `src/utils/graphqlQueries/queries.ts`.
- Models live in `src/models`.
- Comment non-obvious logic and the reason for it, not every line.
- UI: follow the Blok design system, Tailwind + shadcn components.

# Commands
- Dev: `npm run dev`
- Build: `npm run build`

# Guardrails
- Never log or display bearer tokens or context IDs.
- Do not edit `.env*` files. Tell me which variables to add instead.
- Ask before running any transfer or install against a real environment.