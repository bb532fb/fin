import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Crypto AI Analyst", template: "%s · Crypto AI Analyst" },
  description:
    "Կրիպտո զույգերի շուկայական վերլուծություն՝ signal confidence, ռիսկի մակարդակ և AI բացատրություններ։ Միայն վերլուծական տեղեկություն։",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="hy"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('caa-theme')==='light')document.documentElement.dataset.theme='light'}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-full max-w-[100vw] flex-col overflow-x-clip font-sans">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
