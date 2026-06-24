import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tel Aviv Heat Ledger",
  description:
    "An exploratory dashboard showing how Tel Aviv Coast temperatures have changed since 2005.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
