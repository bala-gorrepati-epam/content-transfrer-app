# Content Transfer App

A SitecoreAI Marketplace standalone app that copies content items from one SitecoreAI environment to another, and can also package items into a zip file for import later.

## Introduction

Moving content between Sitecore environments typically involves exporting and importing packages. However, since this feature has been removed in Sitecore AI, teams must now rely on Sitecore AI APIs.

This standalone marketplace app provides a user interface for seamless content transfer by calling Sitecore AI APIs in the background. While several similar apps are already publicly available on the marketplace, this custom solution is specifically designed for EPAM teams. This ensures that any bugs, issues, or upgrade requests can be quickly addressed and resolved internally, eliminating the need to depend on external vendors.

The app includes the following key features:

- **Transfer:** copy selected items straight from a source environment to a destination.
- **Package designer:** export selected items from a source environment into a single `.zip` file.
- **Install package:** load a `.zip` made by Package designer and install it into a destination environment.
- **Compare environments:** see the content tree and field values of two environments side by side, in one language, and spot what is missing or different.
- **Known issues:** a list of problems seen during development and how they were resolved.

You browse the source environment's content tree, tick the items you want, and choose how each one should be merged into the destination (for example, override or keep the existing item).

## Compare Environments

Compare environments shows the items under `/sitecore` in a source environment and a target environment, side by side. Use it to check what differs before you transfer. Nothing is written to either environment.

1. **Language:** choose the language to compare. English is always available. To add another, click **Manage languages**, then enter a label (for example `German`) and its code (for example `de-de`). The list is saved in your browser.
2. **Source and Target:** choose the two environments. They must be different.
3. **Expand items** to compare their children. Each row shows the source on the left and the target on the right. A grey dashed box means the item is not in that environment.

Markers:

- **Green:** the item is identical in both environments.
- **Red:** the field values differ, or could not be read. Click the item's name to see the differing fields.
- **Orange:** the item exists in only one environment, or has no version in the chosen language (shown as `(0 versions)`).

Click **Refresh** on an item to reload it from both environments. Everything below it collapses, so you see its current children. Turn on **Show grid lines** to see row and column boundaries.

Changing the environment or the language starts a new comparison.

## Getting Started

### Prerequisites

- Node.js 20.9 or newer (Next.js 16 minimum). This project was built on Node 26 LTS.
- Access to a SitecoreAI tenant where the app is registered as a Marketplace standalone app.

### Install and run

```sh
npm install
npm run dev
```

The app runs at `http://localhost:3000`. Pages that use the Marketplace client only work when loaded inside SitecoreAI, because the client talks to the host through `window.parent`. A normal browser tab will show "Could not connect" or stay on "Loading".

The app can also be hosted on [Vercel](https://vercel.com) (or any other Next.js host). Deploy it, then register the deployed URL as the app's URL in SitecoreAI, so it can be used from the Marketplace app.

### Register the app

Register the app in SitecoreAI as a standalone extension. The app has two routes, and each one is registered as its own app URL. Pick the one that matches how your team works (see [Routes](#routes)). During registration, grant these permissions:

- **API Access:** SitecoreAI APIs.
- **Permissions:** Allow Popups, Download files.

Without these, the app cannot read environments or download packages. For details, see the [Sitecore Marketplace documentation](https://doc.sitecore.com/mp/en/developers/marketplace/introduction-to-sitecore-marketplace.html).

### Routes

| Route                         | Use it for                                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/content-transfer`           | The normal app. It lists every environment the Marketplace gives the app. No extra setup. Destination checks are not run, because there is no sign-in token.                                                                                                       |
| `/content-transfer-with-rbac` | Role-based access. Environments are filtered by each user's roles. Organization admins and owners see everything. Other users sign in through Auth0, and their item reads and destination checks go through the custom auth route. Needs the Auth0 settings below. |

The RBAC route needs these environment variables. Set them in your hosting environment (for example Vercel). For local development, put them in a `.env` file in the project root. That file is git-ignored, so it is not committed. Use the values from your Auth0 and Sitecore setup:

- `NEXT_PUBLIC_AUTH0_DOMAIN`
- `NEXT_PUBLIC_AUTH0_CLIENT_ID`
- `NEXT_PUBLIC_AUTH0_AUDIENCE`
- `NEXT_PUBLIC_AUTH0_SCOPE`
- `NEXT_PUBLIC_SITECORE_APP_ID`
- `NEXT_PUBLIC_APP_BASE_URL`: must match a callback URL registered in Auth0.

If one of these is missing, the RBAC route shows "Authentication is not configured". The normal route does not use them.

### Useful commands

| Command         | What it does                                   |
| --------------- | ---------------------------------------------- |
| `npm run dev`   | Start the development server                   |
| `npm run build` | Create a production build                      |
| `npm run check` | Run ESLint and the Prettier check (no changes) |
| `npm run fix`   | Run ESLint auto-fix and Prettier formatting    |

## Code Flow

1. **Entry points:** `src/app/content-transfer/page.tsx` (normal route) and `src/app/content-transfer-with-rbac/page.tsx` (RBAC route) get the Marketplace client and the list of environments the app can access. The RBAC page also reads the user's roles and filters that list. Both show a loading state until they are ready.
2. **Layout:** `AppShell` draws the sidebar, top bar and content area. The sidebar lists the features defined in `src/features/registry.ts`.
3. **Features:** each feature is a component that receives the client and environment list. Only the active feature is shown, and navigation is locked while a run is in progress.
4. **Browsing:** the source tree loads children only when a node is expanded, and pages through large folders on request.
5. **Transfer and package operations:** `src/lib/contentTransfer.ts` runs the content transfer steps against the SitecoreAI APIs, and reports progress for each step. Failures name the step that broke, and the source transfer is cleaned up in every case.
6. **Packages:** `src/lib/contentPackage.ts` builds and validates the zip file. The package records the items, their chunks and the chunk metadata that Install needs.
7. **Compare:** `src/utils/hooks/useContentDiff.ts` loads the two trees one node at a time, and `src/lib/contentDiff.ts` labels each item. The language list is kept in the browser (`src/utils/hooks/useCompareLanguages.ts`). The compare feature is documented in CLAUDE.md.

For the step-by-step API flow and the package format, see [docs/content-transfer-flow.md](docs/content-transfer-flow.md).

## Technologies Used

- **Next.js 16** with the App Router and TypeScript (strict mode).
- **React 19.**
- **Sitecore Marketplace SDK** (`@sitecore-marketplace-sdk/client` and `@sitecore-marketplace-sdk/xmc`) for the host connection and SitecoreAI calls.
- **Tailwind CSS v4** for styling.
- **Blok design system** (Sitecore), installed from its component registry, with shadcn-style components and Material Design icons.
- **fflate** for building and reading zip packages.
- **ESLint and Prettier** for code checks and formatting.

## 🤖 Built with Vibe Coding

This app was built entirely through vibe coding with [Claude](https://claude.com/claude-code), using Claude Code in the terminal. The code, styling, documentation and this README were written by Claude from plain-language requests, with the developer reviewing, running and testing each change.

Project knowledge for Claude lives in:

- [CLAUDE.md](CLAUDE.md): the project rules, architecture, SDK facts and open questions. Claude reads it at the start of each session.
- [docs/content-transfer-flow.md](docs/content-transfer-flow.md): the content transfer flow and the package format.
- `.claude/skills/content-transfer-sdk/`: the SDK operation reference used before any content transfer call is written.

**Keep these up to date.** When you change behaviour, add a feature, change how the SDK is used, or change a setting, update CLAUDE.md, `docs/content-transfer-flow.md`, the skill and this README in the same change. Claude relies on these files to work correctly in later sessions, so out-of-date notes lead to wrong code.

## 📝 License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.

## 🐛 Issues

If you encounter any issues or have suggestions for improvements, please open an issue on the repository.
