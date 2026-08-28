import type { Metadata } from "next";
import { Hedvig_Letters_Serif, Inria_Serif, Inter } from "next/font/google";
import "./globals.css";

// Inter is the typeface the Figma scenes use. Self-hosted by next/font so the
// headless renderer never waits on a third-party font request mid-capture.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Display serif for the Achievements scene. Ships in one weight only, which is
// the single weight the design uses.
const hedvigLettersSerif = Hedvig_Letters_Serif({
  variable: "--font-hedvig",
  subsets: ["latin"],
  weight: "400",
});

// The display serif the achievements collage sets its title and closing line in
// (Figma reports both as `Inria Serif: Bold`). Bold only — that is the single
// weight the design uses.
const inriaSerif = Inria_Serif({
  variable: "--font-inria",
  subsets: ["latin"],
  weight: "700",
});

export const metadata: Metadata = {
  title: "MoreTasks Screens",
  description: "Generate office-screen videos for birthdays, MVPs, joiners and farewells.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${hedvigLettersSerif.variable} ${inriaSerif.variable} h-full antialiased`}
      // Some browser extensions (screen recorders, clippers) inject attributes into
      // <html> before React hydrates. That's a mismatch React can't do anything
      // about, so silence the warning rather than let the dev overlay flag it as a
      // real bug — the headless renderer runs with no extensions and never sees this.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
