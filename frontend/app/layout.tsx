import type { Metadata } from "next";
import { Geist, Geist_Mono, Syne } from "next/font/google";
import "./globals.css";
import { MetaPixel } from "./meta-pixel";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://timelessapp.ai"),
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    shortcut: "/favicon.png",
    apple: "/timeless-icon.png",
  },
  itunes: {
    appId: "6740804440",
    appArgument: "https://timelessapp.ai/download",
  },
  title: "Timeless: Short Dramas",
  description:
    "Watch addictive vertical short dramas, free previews, and Timeless Original series on iPhone and Android.",
  openGraph: {
    title: "Timeless: Short Dramas",
    description:
      "Big emotions, short episodes. Discover Timeless Original short dramas made for mobile.",
    url: "https://timelessapp.ai",
    siteName: "Timeless: Short Dramas",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Timeless: Short Dramas",
    description:
      "Big emotions, short episodes. Discover Timeless Original short dramas made for mobile.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          src="/meta-pixel-bootstrap.js"
          id="meta-pixel-bootstrap"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} antialiased`}
      >
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
