# Content Transfer App

A SitecoreAI Marketplace standalone app that copies content items from one SitecoreAI environment to another, and can also package items into a zip file for import later.

## Introduction

Moving content between SitecoreAI environments normally means exporting and importing by hand. This app does it from inside SitecoreAI:

- **Transfer:** copy selected items straight from a source environment to a destination.
- **Package designer:** export selected items from a source environment into a single `.zip` file.
- **Install package:** load a `.zip` made by Package designer and install it into a destination environment.
- **Known issues:** a list of problems seen during development and how they were resolved.

You browse the source environment's content tree, tick the items you want, and choose how each one should be merged into the destination (for example, override or keep the existing item).

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

Register the app in SitecoreAI as a standalone extension, pointing at the `/content-transfer` route. During registration, grant these permissions:

- **API Access:** SitecoreAI APIs.
- **Permissions:** Download files.

Without these, the app cannot read environments or download packages. For details, see the [Sitecore Marketplace documentation](https://doc.sitecore.com/mp/en/developers/marketplace/introduction-to-sitecore-marketplace.html).

### Useful commands

| Command         | What it does                                   |
| --------------- | ---------------------------------------------- |
| `npm run dev`   | Start the development server                   |
| `npm run build` | Create a production build                      |
| `npm run check` | Run ESLint and the Prettier check (no changes) |
| `npm run fix`   | Run ESLint auto-fix and Prettier formatting    |

## Code Flow

1. **Entry point:** `src/app/content-transfer/page.tsx` gets the Marketplace client and the list of environments the app can access. It shows a loading state until both are ready.
2. **Layout:** `AppShell` draws the sidebar, top bar and content area. The sidebar lists the features defined in `src/features/registry.ts`.
3. **Features:** each feature is a component that receives the client and environment list. Only the active feature is shown, and navigation is locked while a run is in progress.
4. **Browsing:** the source tree loads children only when a node is expanded, and pages through large folders on request.
5. **Transfer and package operations:** `src/lib/contentTransfer.ts` runs the content transfer steps against the SitecoreAI APIs, and reports progress for each step. Failures name the step that broke, and the source transfer is cleaned up in every case.
6. **Packages:** `src/lib/contentPackage.ts` builds and validates the zip file. The package records the items, their chunks and the chunk metadata that Install needs.

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

**Keep these up to date.** When you change behaviour, add a feature, confirm an unverified SDK detail, or change a setting, update CLAUDE.md, `docs/content-transfer-flow.md`, the skill and this README in the same change. Claude relies on these files to work correctly in later sessions, so out-of-date notes lead to wrong code.

## 📝 License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.

## 🐛 Issues

If you encounter any issues or have suggestions for improvements, please open an issue on the repository.
