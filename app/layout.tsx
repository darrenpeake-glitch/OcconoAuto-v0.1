import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/app/providers";
import { NavBar } from "@/components/nav-bar";

export const metadata: Metadata = {
  title: "OcconoAuto v0.1",
  description: "Service workflow board"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <NavBar />
          <main className="container py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
