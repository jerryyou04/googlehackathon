"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  History,
  Upload,
  FolderOpen,
  Sparkles,
  BarChart3,
} from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "History", icon: History },
  { href: "/categories", label: "Categories", icon: BarChart3 },
  { href: "/files", label: "Files", icon: FolderOpen },
  { href: "/insights", label: "Insights", icon: Sparkles },
];

export default function Nav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-50 h-14 bg-gradient-to-r from-[#004d26] to-[#007A3E] flex items-center px-4 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-xl tracking-tight">
            myspend
          </span>
          <span className="text-[#86efac] text-xs font-medium bg-white/10 px-2 py-0.5 rounded-full">
            powered by Gemini
          </span>
        </div>

        {/* Desktop links */}
        <nav className="hidden sm:flex items-center gap-1 ml-8">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(href)
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop upload CTA */}
        <Link
          href="/upload"
          className="hidden sm:flex ml-auto items-center gap-1.5 bg-white text-[#004d26] font-semibold text-sm px-4 py-1.5 rounded-full hover:bg-[#F0F5F2] transition-colors"
        >
          <Upload size={14} />
          Upload
        </Link>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-[#E2E8E4] h-16 flex items-center justify-around px-2">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          if (href === "/upload") {
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-0.5"
              >
                <span className="w-14 h-14 bg-[#00A651] rounded-full -mt-5 flex items-center justify-center shadow-lg">
                  <Upload size={22} className="text-white" />
                </span>
              </Link>
            );
          }
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 ${
                active ? "text-[#00A651]" : "text-gray-400"
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
