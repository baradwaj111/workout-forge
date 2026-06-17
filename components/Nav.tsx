"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, History, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/today", label: "Today", icon: Dumbbell },
  { href: "/history", label: "History", icon: History },
];

export default function Nav() {
  const path = usePathname();
  if (path === "/onboarding") return null;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
        <Link href="/today" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Flame className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-black tracking-tight gradient-text">FORGE</span>
        </Link>
        <nav className="flex gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-all",
                path === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
