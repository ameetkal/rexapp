import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Rex - Share & Save Recommendations",
  description: "The social platform where friends share and save trusted recommendations for movies, restaurants, books, music, and travel.",
  keywords: ["recommendations", "social", "friends", "movies", "restaurants", "books", "music", "travel"],
  authors: [{ name: "Rex Team" }],
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
          <link rel="icon" type="image/png" href="/rexlogo.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/rexlogo.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/rexlogo.png" />
          <link rel="icon" type="image/png" sizes="192x192" href="/rexlogo.png" />
          <link rel="icon" type="image/png" sizes="512x512" href="/rexlogo.png" />
          <link rel="shortcut icon" href="/rexlogo.png" />
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
