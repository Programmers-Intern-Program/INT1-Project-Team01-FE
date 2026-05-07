import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-arcade",
  subsets: ["latin"],
});

const pressStart = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

const vt323 = VT323({
  variable: "--font-vt323",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Office",
  description: "AI 가상화 오피스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${jetbrainsMono.variable} ${pressStart.variable} ${vt323.variable} h-full antialiased`}
    >
      <body className="theme-web min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
