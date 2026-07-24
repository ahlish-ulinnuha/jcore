import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "./RegisterServiceWorker";

export const metadata: Metadata = {
  title: "JCore",
  description: "Administrasi purchase request harian untuk toko dan vendor.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#952423",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
