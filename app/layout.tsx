import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task eXperience · La vida real también da Xp",
  description: "Tu espacio familiar de misiones, pequeños logros y grandes planes.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/task-experience-emoji.png",
    shortcut: "/task-experience-emoji.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
