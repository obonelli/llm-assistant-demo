import "./globals.css";
import "@/app/styles/effects-dimple.css";
import "@/app/styles/effects-cursor.css";
import "@/app/styles/airport-footer.css";
import "@/app/styles/damage-letters.css";
import { Inter_Tight } from "next/font/google";

const inter = Inter_Tight({ subsets: ["latin"], variable: "--font-display" });

export const metadata = {
  title: "Obonelli.dev",
  description: "Next.js + cyberpunk UI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-ink text-white antialiased">{children}</body>
    </html>
  );
}
