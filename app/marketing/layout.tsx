import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";

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
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Analytics placeholder - add PostHog, Vercel Analytics, or similar here */}
        {/* Example: <script src="https://app.posthog.com/..." /> */}
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
