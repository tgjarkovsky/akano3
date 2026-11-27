import type { Metadata } from "next";
import { Oswald, Spectral, Space_Mono, Rock_Salt, Inria_Serif, Inknut_Antiqua } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers"

// Akano3 DS type system: Oswald display · Spectral body serif · Space Mono meta · Rock Salt brush
const oswald = Oswald({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
});

const spectral = Spectral({
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
});

const rockSalt = Rock_Salt({
  variable: "--font-brush",
  weight: ["400"],
  subsets: ["latin"], // Rock Salt: no latin-ext; brush accent only, no Czech running copy
});

// Písma vizuálního manuálu (docs/vizualni-manual.md), zatím jen pro přihlášku:
// Inria Serif na text a nadpisy h3+, Inknut Antiqua (jen regular) na h1, h2 a tlačítka.
const inria = Inria_Serif({
  variable: "--font-inria",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin", "latin-ext"],
});

const inknut = Inknut_Antiqua({
  variable: "--font-inknut",
  weight: ["400"],
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "AKANO",
  description: "AKANO",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="cs"
      className={`${oswald.variable} ${spectral.variable} ${spaceMono.variable} ${rockSalt.variable} ${inria.variable} ${inknut.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <Script
          src="https://bugfinder-khaki.vercel.app/widget.js"
          data-project="akano3"
          // bez plovoucí berušky; hlášení chyby otevře Ctrl+Shift+B
          data-icon="off"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
