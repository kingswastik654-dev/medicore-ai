import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/kit";

export const metadata: Metadata = {
  title: "MediCore AI — The Intelligent Hospital OS",
  description:
    "One platform for patient access, clinical care, diagnostics, pharmacy and revenue — with governed AI copilots on every workflow.",
  metadataBase: new URL("https://medicore.ai"),
  openGraph: {
    title: "MediCore AI — The Intelligent Hospital OS",
    description: "Every department. One heartbeat. Governed AI that drafts, you decide.",
    type: "website",
  },
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('medcore_theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;700;800&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
