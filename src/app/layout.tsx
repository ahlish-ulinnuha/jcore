import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JCore",
  description: "Administrasi purchase request harian untuk toko dan vendor.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
