import { Metadata } from "next";
import { headers } from "next/headers";

interface Props {
  searchParams: Promise<{
    hostname?: string;
    score?: string;
    clarity?: string;
    value?: string;
    structure?: string;
    conversion?: string;
    trust?: string;
  }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const {
    hostname = "a landing page",
    score = "0",
    clarity = "0",
    value = "0",
    structure = "0",
    conversion = "0",
    trust = "0",
  } = params;

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3001";
  const proto = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  const imageParams = new URLSearchParams({ hostname, score, clarity, value, structure, conversion, trust });
  const imageUrl = `${baseUrl}/api/share-image?${imageParams}`;

  const title = `${hostname} scored ${score}/10 🍞`;
  const description = `This page is toasted. Get your own free landing page roast.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ResultPage({ searchParams }: Props) {
  const params = await searchParams;
  const { hostname = "a landing page", score = "0" } = params;

  return (
    <main className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center px-4 text-center gap-6">
      <div className="text-5xl">🍞</div>
      <h1 className="text-2xl font-bold text-gray-900">
        {hostname} scored {score}/10
      </h1>
      <p className="text-gray-500 max-w-sm">
        This page is toasted. Get brutally honest feedback on your own landing page — free.
      </p>
      <a
        href="/"
        className="text-white text-sm font-medium px-6 py-3 rounded-xl transition-colors" style={{ backgroundColor: "#ea580c" }}
      >
        Roast my page →
      </a>
    </main>
  );
}
