import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scroll Mirror",
  description: "A reflective tool for reading your feed as a digital life artifact."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
