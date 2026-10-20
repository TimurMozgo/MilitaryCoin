import type { Metadata } from "next";
import "./globals.css";
import "./tactical.css";

export const metadata: Metadata = {
  title: "Коллекционные монеты",
  description: "Монеты для вашей коллекции. Каталог, заказ и история покупок.",
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
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}


