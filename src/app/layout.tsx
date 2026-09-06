import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Ops",
  description: "Team operations hub — updates, rota, checklists, SOPs and more.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Team Ops",
  },
};

export const viewport: Viewport = {
  themeColor: "#1F3A5F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
