import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Rex - A calm place to remember what you do",
  description: "Log books, places, movies, and moments. See patterns. Turn 'want to' into 'did.' Private by default. No likes. No performative feed.",
  keywords: ["life ledger", "recommendations", "personal tracking", "books", "movies", "places", "social", "privacy"],
  authors: [{ name: "Rex Team" }],
  openGraph: {
    title: "Rex - A calm place to remember what you do",
    description: "Log books, places, movies, and moments. See patterns. Turn 'want to' into 'did.'",
    type: "website",
    url: "https://tryrex.app",
    siteName: "Rex",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rex - A calm place to remember what you do",
    description: "Log books, places, movies, and moments. See patterns. Turn 'want to' into 'did.'",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          
          {/* PWA Manifest */}
          <link rel="manifest" href="/manifest.json" />
          
          {/* iOS PWA Meta Tags */}
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Rex" />
          <link rel="apple-touch-icon" href="/rexlogo.png" />
          
          {/* Theme Colors */}
          <meta name="theme-color" content="#2563eb" />
          <meta name="msapplication-TileColor" content="#2563eb" />
          
          {/* Favicons */}
          <link rel="apple-touch-icon" href="/rexlogo.png" />
        </head>
        <body
          className={`${inter.variable} font-sans antialiased`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
