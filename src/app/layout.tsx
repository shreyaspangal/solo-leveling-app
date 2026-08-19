import type { Metadata } from "next";
import { Chakra_Petch, Rajdhani } from "next/font/google";
import { MotionProvider } from "@/components/motion-provider";
import "./globals.css";

// Rajdhani (body) + Chakra Petch (headings/labels/numeric displays) replace
// Geist Sans/Mono -- part of ADR-007's sci-fi visual theme, matching the
// client's reference prototype's typography exactly.
const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Solo Leveling",
  description: "An individual development dashboard for real-life consistency.",
};

// `dark` is always on `<html>` -- ADR-007 commits to a dark-only theme, no
// light variant and no toggle, so this isn't conditional on anything.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${rajdhani.variable} ${chakraPetch.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
