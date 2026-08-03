"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";

const NAV_ITEMS = [
  { href: "/", label: "Run Summary" },
  { href: "/explorer", label: "Explorer" },
  { href: "/data-center", label: "Data-center" },
  { href: "/agent", label: "Agent" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 focus-ring rounded-md">
            <span className="text-xl font-bold tracking-tight text-slate-900">Oracle</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main">
            {NAV_ITEMS.map(({ href, label }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-3 py-2 text-sm font-medium transition focus-ring rounded-md ${
                    active
                      ? "text-indigo-600"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {label}
                  {active ? (
                    <span className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-indigo-600" />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
