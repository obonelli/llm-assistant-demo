import "./globals.css";
import "@/app/styles/effects-dimple.css";
import "@/app/styles/effects-cursor.css";
import "@/app/styles/airport-footer.css";
import "@/app/styles/damage-letters.css";
import "@/app/styles/layout-shell.css";

import { Inter_Tight } from "next/font/google";
import Navbar from "@/app/components/Navbar";
import Assistant from "@/app/components/Assistant";
import { Suspense } from "react";

const inter = Inter_Tight({ subsets: ["latin"], variable: "--font-display" });

export const metadata = { title: "LLM Platform", description: "Next.js + cyberpunk UI" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-ink text-white antialiased">
        <div className="app-navbar">
          <Suspense fallback={null}>
            <Navbar />
          </Suspense>
        </div>
        <div>{children}</div>
        <Assistant />
      </body>
    </html>
  );
}
