import type { Metadata } from "next";
import { IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const mono = IBM_Plex_Mono({ 
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono"
});

const serif = Source_Serif_4({ 
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-serif"
});

export const metadata: Metadata = {
  title: "Fountain Availability",
  description: "OnceHub scheduling availability tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${mono.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}
