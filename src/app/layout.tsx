import type { Metadata } from "next";
import { Inter_Tight, Newsreader } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Commonplace — Buy & sell big items, delivered",
    template: "%s · Commonplace",
  },
  description:
    "The marketplace for treadmills, hot tubs, Peloton, golf carts, furniture and more — verified, inspected, and delivered within 100 miles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${newsreader.variable}`}
    >
      {/* The marketplace is a full-viewport app shell; the shell manages its
          own internal scrolling, so the document body itself does not scroll. */}
      <body style={{ height: "100dvh", overflow: "hidden", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
