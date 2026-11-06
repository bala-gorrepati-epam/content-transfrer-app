import type { Metadata } from "next";
import "./globals.css";
import { themeInitScript } from "@/src/lib/theme";

export const metadata: Metadata = {
  title: "Sitecore Marketplace Extensions",
  description: "Sitecore Marketplace extension starter application",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The init script adds the "dark" class before hydration, so the server and client html can differ.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
