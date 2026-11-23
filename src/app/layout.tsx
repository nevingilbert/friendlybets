import type { Metadata, Viewport } from "next";

import { currentUser } from "@/auth";
import { MeProvider } from "@/components/me-context";
import { missingConfiguration } from "@/lib/env";
import { SetupNotice } from "@/screens/setup-notice";
import "./globals.css";

export const metadata: Metadata = {
  title: "FriendlyBets",
  description: "Create a lobby, share the link, bet your friends on anything.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const missing = missingConfiguration();
  const me = missing.length === 0 ? await currentUser() : null;

  return (
    <html lang="en">
      <body>
        {missing.length > 0 ? <SetupNotice missing={missing} /> : <MeProvider me={me}>{children}</MeProvider>}
      </body>
    </html>
  );
}
