import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Toaster } from "@/components/ui/sonner";
import { seedDefaultsIfEmpty } from "@/server/queries/rules";
import { seedDefaultChecklistItemsIfEmpty } from "@/server/queries/checklist";
import { seedDefaultAccountSettingsIfEmpty } from "@/server/queries/account";

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Gold Journal",
  description: "A discipline-first trading journal for XAUUSD.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await Promise.all([
    seedDefaultsIfEmpty(),
    seedDefaultChecklistItemsIfEmpty(),
    seedDefaultAccountSettingsIfEmpty(),
  ]);

  return (
    <html lang="en" className={`${sourceSerif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
