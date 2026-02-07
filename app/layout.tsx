import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const metadata = {
  title: "Startup Runway Monte Carlo Lab",
  description: "Model startup runway risk with correlated Monte Carlo simulations"
};

function Nav() {
  return (
    <nav className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80">
      <div className="mx-auto flex max-w-6xl items-center gap-6 p-4 text-sm">
        <Link href="/" className="font-semibold text-slate-900 dark:text-white">
          Monte Carlo Lab
        </Link>
        <Link href="/model">Model</Link>
        <Link href="/scenarios">Scenarios</Link>
        <Link href="/simulate">Simulate</Link>
        <Link href="/docs">Docs</Link>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Nav />
        <main className="mx-auto max-w-6xl p-6">{children}</main>
        <footer className="mx-auto max-w-6xl border-t border-slate-200 dark:border-slate-800 p-6 text-xs text-slate-600 dark:text-slate-400">
          Educational and experimental tool only. Not investment, financial, or legal advice.
        </footer>
      </body>
    </html>
  );
}
