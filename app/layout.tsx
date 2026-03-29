import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3001";

export const metadata: Metadata = {
  title: "Landing Page Roaster — Brutally honest feedback in 30s",
  description: "Paste your landing page URL and get an AI-powered score, breakdown, and rewrite suggestion. Free. No signup.",
  openGraph: {
    title: "Landing Page Roaster — Brutally honest feedback in 30s",
    description: "Get a brutally honest, AI-powered critique of your landing page in 30 seconds. Free. No signup.",
    images: [{ url: `${baseUrl}/api/share-image?default=1`, width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Landing Page Roaster — Brutally honest feedback in 30s",
    description: "Get a brutally honest, AI-powered critique of your landing page in 30 seconds.",
    images: [`${baseUrl}/api/share-image?default=1`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
