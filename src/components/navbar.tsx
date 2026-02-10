"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { BarChart3, LayoutGrid, LogOut, Settings } from "lucide-react";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;

  const links = [
    { href: "/dashboard", label: "Track", icon: LayoutGrid },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-ngtz-bg/80 backdrop-blur-md border-b border-ngtz-border">
      <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="font-display font-bold text-sm text-gray-300 tracking-tight">
          NGTZ
        </Link>

        <div className="flex items-center gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all",
                  active
                    ? "bg-[#1a1a1a] text-gray-200"
                    : "text-[#555] hover:text-[#888]"
                )}
              >
                <Icon size={14} />
                {link.label}
              </Link>
            );
          })}

          <div className="w-px h-5 bg-ngtz-border mx-2" />

          <div className="flex items-center gap-2">
            {session.user?.image && (
              <img
                src={session.user.image}
                alt=""
                className="w-6 h-6 rounded-full opacity-60"
              />
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-[#444] hover:text-[#888] transition-colors p-1"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
