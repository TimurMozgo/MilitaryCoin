import type { Metadata } from "next";
import "./globals.css";
import "./tactical.css";
import "./armory.css";

export const metadata: Metadata = {
  title: "Колекційні монети",
  description: "Монети для вашої колекції. Каталог, замовлення та історія покупок.",
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
    <html lang="uk">
      <body className="antialiased">{children}</body>
    </html>
  );
}


