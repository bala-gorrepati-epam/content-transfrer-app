# Project
Next.js 16.1 (App Router, TypeScript strict) SitecoreAI Marketplace standalone app.
Purpose: copy content items from one SitecoreAI environment to another.
- App URL in registration: `/content-transfer`
- Entry point: `src/app/content-transfer/page.tsx`
- The page renders the app shell (`src/components/layout/AppShell.tsx`): a sidebar lists the features from `src/features/registry.ts` (Transfer, Download package, Install package, Known issues).

# SDK Usage
- For content transfer operations (createContentTransfer to deleteContentTransfer), use the `content-transfer-sdk` skill before writing the call. Keep the skill up to date when the SDK behaviour changes.
- Client comes from the `useMarketplaceClient` hook (`src/utils/hooks/useMarketplaceClient`). Never create a second client.
- `client.application.context` is stored in `appContext` state.
  `appContext.resourceAccess[]` lists the environments the app can access.
  Use `resourceAccess[i].context.preview` as the context ID for xmc calls.
  Use `appContext.resourceAccess[i].tenantDisplayName` as the display name for environment
- Authentication is handled by the client. Call `client.mutate("<operation>", params)` for mutations and `client.query("<operation>", params)` for queries. Which operations are queries is listed under "SDK facts" below. Do not add your own auth.

# Feature: content transfer
Full flow and rules: @docs/content-transfer-flow.md

Three modes in /content-transfer:
1. Transfer: pick source + destination (must differ; label environments by name, never by context ID)
    -> browse the source tree (see Source tree browsing below) -> multi-select items
    -> set Scope and MergeStrategy per item -> run transfer -> show per-step progress.
2. Download package: same selection as Transfer, source only -> export, bundle as .zip, download.
3. Install package: upload our .zip, pick destination, confirm, install. The destination may be the environment the package came from.

## Source tree browsing
Items are fetched with the `GetItems` function in `src/lib/getItems.ts`. It calls
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
- Done: `hasNextPage` is `boolean`. `GetItems` returns the full `Item`, including its `item` level, which matches the real response.

Selection:
- Multi-select with checkboxes. Store selections by `path` (plus `name` for display) so they survive collapsing and expanding.
- Scope (`SingleItem` | `ItemAndDescendants`) and MergeStrategy (`OverrideExistingItem` | `KeepExistingItem` | `LatestWin` | `OverrideExistingTree`) are set per selected item. Defaults for new selections: `SingleItem` and `OverrideExistingItem`.
- Avoid overlapping dataTrees: if an item is selected with `ItemAndDescendants`, its descendants are already covered. Show them as covered, and drop any separate selections of them.
- The selected list shows each item's path, scope and mergeStrategy, and these become the `dataTrees` of `createContentTransfer`.

# Tech stack (versions in package.json)
- Next 16.1.1 (Turbopack), React 19.1.1, TypeScript 5.9.2 (strict).
- Node: v26.13.0 LTS, installed via winget. Earlier it was v22.2.0, which could not load Tailwind's ESM-only `magic-string`. Do not add an npm override for this.
- Other dependencies: `fflate` (zip), `eslint` 9 with `eslint-config-next` 16.1.1 (flat config in `eslint.config.mjs`), `prettier` with `eslint-config-prettier`. Removed: `lucide-react`, `@eslint/eslintrc`.
- Styling: Tailwind v4 (`@tailwindcss/postcss`, `tw-animate-css`), `src/app/globals.css`, shadcn config in `components.json` (style new-york, baseColor neutral, icon library mdi). Aliases: `@/src/components`, `@/src/lib/utils`, `@/src/components/ui`, `@/src/utils/hooks`.
- Layout colours: page background is `bg-muted`. Panels are white cards with `rounded-lg border border-border bg-card p-4 shadow-sm`, because the theme's card colour is the same white as the page.
- Components in `src/components/ui/` are Blok registry versions of accordion, alert, badge, button, checkbox, dialog, label, progress, select and tabs. Dependencies include `radix-ui` and `@mdi/js`.
- Design system: Blok (Sitecore), https://blok.sitecore.com/. Installed from its shadcn-style registry, not an npm package:
  `npx shadcn@latest add https://blok.sitecore.com/r/theme.json <component urls>`, where component urls look like `https://blok.sitecore.com/r/button.json`. Applied to button, checkbox, select, dialog, tabs, accordion, badge, alert, progress and label. The theme added Blok's CSS variables to `src/app/globals.css`.
- Blok variant names differ from shadcn defaults: Alert uses `danger` (not `destructive`), Badge has `default` and `bold` (no `secondary`), Button and Select follow the Blok set. Check `src/components/ui/*.tsx` for the valid variants before using one.
- Icons are Blok's set: `@mdi/js` paths rendered with `Icon` from `src/lib/icon.tsx`, e.g. `<Icon path={mdiClose} className="size-4" />`. Do not add lucide-react; it was removed.
- Loading indicators use the CSS ring spinner `LoadingSpinner` (`src/components/ui/loading-spinner.tsx`), not an icon or a GIF.
- SDK: `@sitecore-marketplace-sdk/client` ^0.3.6 and `@sitecore-marketplace-sdk/xmc` ^0.4.2. Installed types are in `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-content-transfer/` (`sdk.gen.d.ts`, `augmentation.gen.d.ts`).

# Architecture (where things are)
- `src/features/registry.ts`: the feature list (`FEATURES`: id, label, Blok icon path, component). Add a feature by writing its component and adding one entry. Sidebar order follows the array. Features receive `{ client, environments }`.
- `src/components/layout/AppShell.tsx`: app layout. Left sidebar with the brand (`public/logo.png`, shown with `next/image`, vertically centred with the title) and a "Navigate" list. Top bar with a sidebar toggle, a breadcrumb and the theme switch. Content has 10% side margin on md+ screens (16px on phones). Only the active feature is mounted, so switching starts it fresh. Navigation locks while a feature reports a run (`FeatureBusyContext` and `useReportBusy` in `src/features/busy.ts`). Each feature has its own Clear button, disabled while running.
- `src/components/theme/ThemeToggle.tsx`: light/dark toggle. Reads the `dark` class on `<html>` through `useSyncExternalStore`. The choice is stored in localStorage under the key in `src/lib/theme.ts`. An inline script in `src/app/layout.tsx` applies it before first paint.
- `src/components/content-transfer/`: `TransferMode` (Transfer), `DownloadPackageMode` (Download package), `InstallPackageMode` (Install package), `EnvironmentSelect`, `SourceTree`, `TreeNode`, `SelectionPanel`, `TransferProgressView`.
- `src/components/known-issues/KnownIssuesMode.tsx`: accordion over `KNOWN_ISSUES` in `src/models/knownIssues.ts`. Add new issues there.
- `src/lib/getItems.ts`: `GetItems(client, sourceContextId, path, after?)`, wraps `xmc.authoring.graphql`.
- `src/lib/contentTransfer.ts`: `runTransfer(...)` (steps 1 to 8), `runDownloadPackage(...)` (steps 1 to 3, write the zip, cleanup) and `runInstallPackage(...)` (steps 4 to 7 with a new transferId). Shared helpers: `runSteps` (source runs, attributes failures to a step, always cleans up) and `importOnDestination` (steps 5 to 7, used by Transfer and Install).
- `src/lib/contentPackage.ts`: `PackageZipWriter` (fflate, writes entries to a `PackageSink`), `createMemorySink` (Download), `readPackage` (validates an uploaded package for Install). Package format and delivery are in `docs/content-transfer-flow.md`.
- `src/lib/icon.tsx`: `Icon` (MDI path renderer). `src/lib/theme.ts`: theme storage key and the init script.
- `src/utils/hooks/useSourceBrowser.ts`: source environment choice, tree and selection, shared by Transfer and Download package.
- `src/utils/hooks/useSourceTree.ts`: lazy tree, pagination, per-node error and retry, stale-response guard using `epoch` and per-node `requestId`.
- `src/utils/hooks/useTreeSelection.ts`: selections keyed by path, Scope and MergeStrategy, covered-item rules.
- `src/utils/hooks/useMarketplaceClient.ts`: the only place the client is created. Retries use a loop.
- `src/utils/graphqlQueries.ts`: `GET_ITEMS` (the query file stays here, not in a `queries/` folder).
- `src/models/`: `getItems.ts` (`Item`, `ItemNode`, `PageInfo`), `contentTransfer.ts` (`SelectedItem`, `DataTree`, step types, `EnvironmentOption`, `BlobStateResponse`, option labels), `contentPackage.ts` (manifest types), `knownIssues.ts`.
- `docs/content-transfer-flow.md`: the flow and rules.
- `.claude/skills/content-transfer-sdk/`: operation reference. Read it before writing any content-transfer SDK call.

# Content transfer: rules that are implemented
- Source operations use the source context ID. Destination operations use the destination context ID. Both come from `resourceAccess[i].context.preview`, selected by index. Never hard-code `resourceAccess[0]`.
- Environment labels use `tenantDisplayName`, with a fallback of `Environment N`. Never show a context ID.
- Tree: root `/sitecore`. Children load on expand only, cached per path. "Load more" appends with no duplicates. A failed node shows Retry. A source change clears the tree and the selection.
- Selection: defaults `SingleItem` and `OverrideExistingItem`. An `ItemAndDescendants` selection covers its descendants. Covered items are disabled, and separate selections below them are removed.
- `runTransfer`: `transferId` is `crypto.randomUUID()`, generated once per run. Polling is every 5 s with a 10 min timeout. Chunks are copied sequentially. No retries. Cleanup (step 8) always runs, and a cleanup error is a warning that does not hide the original failure.
- Install package: `readPackage` validates the zip before anything is sent. All problems are listed together. The user confirms the destination and the install in a dialog.
- The progress panel scrolls into view when a run starts.

# SDK facts (confirmed from installed types or a real run)
- `client.query` (QueryMap): `getContentTransferStatus`, `getChunk`, `consumeFile`, `getBlobState`.
- `client.mutate` (MutationMap): `createContentTransfer`, `saveChunk`, `completeChunkSetTransfer`, `deleteContentTransfer`, and `xmc.authoring.graphql`.
- Responses are wrapped. For a mutation, the body is `result.data`. For a query, the SDK result is `result.data` and the body is `result.data.data`; raw headers are `result.data.response`. Errors are in `result.error` for both. The skill's SKILL.md describes this under "Calls".
- `getChunk`: the chunk's `IsMedia` value is in the `Content-Disposition` header, e.g. `form-data; ItemsProcessed=1; ItemsSkipped=0; IsMedia=false`. Pass it to `saveChunk` as `query.isMedia`. A missing value fails the run.
- `consumeFile`: `fileName` must have the `blob://` prefix. `getBlobState`: `fileName` must not have it.
- `getBlobState` real response (PascalCase): `{ BlobState: "Consumed", Error: null, ConsumedName, Actions: { Details } }`. Done when `BlobState === "Consumed"`. A non-null `Error` fails the run. The installed types declare `status`/`details`, which does not match the real API. The code types it as `BlobStateResponse`.
- `xmc.authoring.graphql` response: `data.item` (with `children.nodes` and `pageInfo`) is the `Item` type.

# Not built yet
- Download package is built (`DownloadPackageMode`). It produces the zip described in `docs/content-transfer-flow.md`.
- Install package is built (`InstallPackageMode`). It validates the uploaded zip, shows its contents, and imports it into the chosen destination after confirmation. Source and destination may be the same environment. The user reported it working.
- The save dialog for Download was removed. The Marketplace iframe blocks file pickers. Do not reintroduce it without checking the host permission first. Download is in-memory only.
- Download in the Marketplace iframe needs the host to allow downloads (`allow-downloads` in the iframe sandbox). Ask the host team if a download is blocked.
- No tests yet.

# Working agreements
- The user runs transfers and installs manually against real environments. Do not run them. Ask first.
- Update the skill only for facts confirmed by a real run or by the installed types, as stated above.
- Do not commit unless asked.
- Never log or display context IDs or bearer tokens. Remove debug `console.log` lines once debugging is done.
- Do not edit `.env*` files. Tell the user which variables to add.

# Commands
- Dev: `npm run dev`
- Build: `npm run build` (passes; it does not run ESLint)
- Type check: `npx tsc --noEmit -p .`
- Lint: `npm run lint` (ESLint). Auto-fix: `npm run lint:fix`.
- Format: `npm run format` (Prettier, writes). Check only: `npm run format:check`.
- Both checks: `npm run check` (lint and format check, no changes). Both fixes: `npm run fix`.
- Prettier settings: `.prettierrc.json` (2 spaces, double quotes, semicolons, trailing commas, 120 characters). Ignored by `.prettierignore` (lock file, `.claude/`, CLAUDE.md, claude.md).
- On Windows (Git Bash), multi-line heredocs with quotes failed. Write multi-line files with the Write tool.
- Editor "Cannot find module ... './globals.css'" squiggle: restart the TS server. `src/types/css.d.ts` declares `*.css`.

# Code style
- 2-space indentation, named exports for React components.
- GraphQL queries live in `src/utils/graphqlQueries.ts`.
- Models live in `src/models`.
- Comment non-obvious logic and the reason for it, not every line.
- UI: follow the Blok design system, Tailwind + shadcn components.
- Icons: Blok (`@mdi/js`) through `Icon`. Branding images: `next/image`.
- Formatting is Prettier; lint is ESLint. Run `npm run check` before handing work back.

# Guardrails
- Never log or display bearer tokens or context IDs.
- Do not edit `.env*` files. Tell me which variables to add instead.
- Ask before running any transfer or install against a real environment.
