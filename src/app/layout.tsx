import localFont from "next/font/local";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ServiceWorkerUpdater } from "@/components/ServiceWorkerUpdater";
import { DebugConsole } from "@/components/DebugConsole";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const sfPro = localFont({
  src: [
    // --- NORMAL ---
    {
      path: "./fonts/SF-Pro-Display-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/SF-Pro-Display-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/SF-Pro-Display-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    // --- ITALIC ---
    {
      path: "./fonts/SF-Pro-Display-RegularItalic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/SF-Pro-Display-MediumItalic.woff2",
      weight: "500",
      style: "italic",
    },
    {
      path: "./fonts/SF-Pro-Display-BoldItalic.woff2",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-sf-pro",
});

export const metadata: Metadata = {
  title: "Gracie Barra",
  description: "Sistema de gestão de presenças Gracie Barra",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Gracie Barra Famalicão",
    startupImage: [
      {
        url: "/splash/splash-750x1334.png",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        url: "/splash/splash-1170x2532.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/splash-1290x2796.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/splash-1536x2048.png",
        media:
          "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
    ],
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ED1C24",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT" className={cn("font-sans", geist.variable, sfPro.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-gb-gray font-sans antialiased">
        {children}
        <InstallPrompt />
        <ServiceWorkerUpdater />
        <DebugConsole />
      </body>
    </html>
  );
}