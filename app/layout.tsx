import type { Metadata } from "next";
import { Bricolage_Grotesque, Caveat } from "next/font/google";
import { AppProviders } from "@/src/components/providers";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
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
      className={`${bricolage.variable} ${caveat.variable}`}
      suppressHydrationWarning
    >
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
