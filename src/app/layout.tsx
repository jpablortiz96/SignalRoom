import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PendoInitializer from "@/components/PendoInitializer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SignalRoom | Watch Real Users Prove Where Your Product Breaks",
  description: "Create 90-second launch trials, collect telemetry, and generate evidence-backed product reports that prove where your product breaks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(apiKey){
    (function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];
    v=['initialize','identify','updateOptions','pageLoad','track','trackAgent'];for(w=0,x=v.length;w<x;++w)(function(m){
    o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
    y=e.createElement(n);y.async=!0;y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';
    z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');
})('06c77be2-7fed-4ff9-a1f0-eec335a92f54');
`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-background text-foreground">
        <PendoInitializer />
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="border-t border-border bg-zinc-950 py-8 text-center text-xs text-zinc-500">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} SignalRoom. Built for Mind the Product World Product Day.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
