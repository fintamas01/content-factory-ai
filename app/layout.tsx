// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from './providers';
import Sidebar from '@/app/components/Sidebar';
import { PLATFORM_DESCRIPTION, PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: PLATFORM_DISPLAY_NAME,
  description: PLATFORM_DESCRIPTION,
  icons: {
    icon: "/CF_favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {/* A flex elrendezés marad, de a Sidebar-nak belső védelme van */}
          <div className="flex min-h-screen bg-slate-50 dark:bg-[#020617]">
            <Sidebar /> 
            <main className="flex-1 overflow-y-auto w-full">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}