import type { Metadata } from "next";
import "./globals.css";
import { Toast } from "@/components/ui/Toast";
import { LoadingOverlay } from "@/components/ui/Loading";
import { RouteLoadingSync } from "@/components/layout/RouteLoadingSync";
import { PWARegister } from "@/components/layout/PWARegister";
import { CookieBanner } from "@/components/legal/CookieBanner";

export const metadata: Metadata = {
  title: "Krešimir Fit Tracker",
  description: "Calorie & macro tracker",
  applicationName: "Krešimir Fit Tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Krešimir Fit",
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1b3255",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hr" className="h-full antialiased">
      <body className="min-h-full">
        <div className="max-w-107.5 mx-auto min-h-screen">{children}</div>
        <RouteLoadingSync />
        <PWARegister />
        <Toast />
        <LoadingOverlay />
        <CookieBanner />
      </body>
    </html>
  );
}
