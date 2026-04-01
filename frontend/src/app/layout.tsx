import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LayerOn",
  description: "DXF layer labeling and colorization tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body>{children}</body>
    </html>
  );
}
