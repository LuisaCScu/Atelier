import { ClosetPersist } from "@/components/closet/closet-persist";
import { NavTour } from "@/components/nav-tour";
import { ProfilePersist } from "@/components/profile-persist";
import { SiteFooter } from "@/components/site-footer";
import { ATELIER_PUBLIC_ORIGIN } from "@/lib/contact";
import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL(ATELIER_PUBLIC_ORIGIN),
  title: "Atelier",
  description: "A digital stylist lookbook. Build a profile, then shop a few outfits that fit your budget.",
  icons: {
    icon: [{ url: "/brand/atelier-mark.png", type: "image/png" }],
    apple: [{ url: "/brand/atelier-mark.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f3f3f3] font-sans text-black">
        <ProfilePersist />
        <ClosetPersist />
        <NavTour />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
