import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { CartProvider } from "@/lib/store/cart-context";
import { DevModeIndicator } from "@/components/ui/DevModeIndicator";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Velvet Bloom Café — Sip. Savor. Bloom.",
  description: "Artisanal culinary craft and digital table ordering. Powered by Kage Origin.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} dark`}>
      <body className="bg-[#080808] text-[#F6EFE7] antialiased min-h-screen">
        <CartProvider>
          {children}
          <DevModeIndicator />
        </CartProvider>
      </body>
    </html>
  );
}
