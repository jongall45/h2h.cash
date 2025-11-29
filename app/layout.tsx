import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ 
  subsets: ["latin"], 
  variable: "--font-space",
  weight: ["300", "400", "500", "600", "700"] 
});

export const metadata: Metadata = {
  title: "h2h.cash",
  description: "Beat opponents. Win cash.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased bg-black text-white overflow-x-hidden selection:bg-[#00FF00] selection:text-black min-h-screen`}>
        <div className="fixed inset-0 z-[100] pointer-events-none opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
        {children}
      </body>
    </html>
  );
}