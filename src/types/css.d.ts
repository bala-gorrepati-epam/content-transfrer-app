// Lets TypeScript accept side-effect CSS imports (e.g. import "./globals.css") without relying on
// next-env.d.ts, which is generated and gitignored, so a fresh clone or editor may not see it.
declare module "*.css";
