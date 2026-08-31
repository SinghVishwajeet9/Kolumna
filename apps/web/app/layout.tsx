import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Kolumna — Structure for your team's chaos",
  description: "A multi-tenant, AI-assisted project board.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* Satoshi — free stand-in for Roobert (which is commercial). */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full">
        {/* Header lives in (app)/layout.tsx now — marketing pages have their
            own nav, so the app chrome shouldn't leak onto the landing page. */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
