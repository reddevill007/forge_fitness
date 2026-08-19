import type { Metadata } from "next";
import { Azeret_Mono, Caveat, Fraunces, Schibsted_Grotesk } from "next/font/google";
import { AppProviders } from "@/src/components/providers";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const ui = Schibsted_Grotesk({
  variable: "--font-ui",
  subsets: ["latin"],
});

const mono = Azeret_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Forge — Train with intention",
  description: "Premium workout planning, progressive overload, and muscle analytics.",
  manifest: "/manifest.webmanifest",
  themeColor: "#c9f43d",
  appleWebApp: {
    capable: true,
    title: "Forge",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${ui.variable} ${mono.variable} ${caveat.variable}`}
      suppressHydrationWarning
    >
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
