import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import Nav from "@/components/nav";

export const metadata: Metadata = {
  title: "SmartSpend — Personal Finance Tracker",
  description: "AI-powered spending tracker built on Google Cloud",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.className} h-full antialiased`}>
      <body className="min-h-full bg-[#F0F5F2]">
        <Nav />
        <div className="pb-20 sm:pb-8">{children}</div>
      </body>
    </html>
  );
}
