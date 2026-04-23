import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "School Pickup",
  description: "Streamlined school pickup for parents and teachers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
