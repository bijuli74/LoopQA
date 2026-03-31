import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoopQA",
  description: "Automated testing platform for wearable watches & companion apps",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <Providers>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}

function Sidebar() {
  const nav = [
    { name: "Dashboard", href: "/", icon: "◉" },
    { name: "Tests", href: "/tests", icon: "▶" },
    { name: "Runs", href: "/runs", icon: "⟳" },
    { name: "Devices", href: "/devices", icon: "⌚" },
    { name: "BLE Inspector", href: "/ble", icon: "⚡" },
    { name: "Pairing", href: "/pairing", icon: "🔗" },
    { name: "Settings", href: "/settings", icon: "⚙" },
  ];

  return (
    <aside className="w-56 border-r border-zinc-800 p-4 flex flex-col gap-1">
      <div className="text-lg font-bold tracking-tight mb-6 px-2">
        <span className="text-emerald-400">Loop</span>QA
      </div>
      {nav.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
        >
          <span>{item.icon}</span>
          {item.name}
        </a>
      ))}
    </aside>
  );
}
