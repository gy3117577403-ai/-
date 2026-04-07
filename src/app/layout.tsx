import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "治具管理系统",
  description: "治具与物资管理",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning={true}
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning={true}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
