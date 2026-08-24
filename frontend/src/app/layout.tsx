import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediCore AI — Hospital Management",
  description: "Integrated hospital management platform with AI layer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
