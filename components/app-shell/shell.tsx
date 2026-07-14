"use client";

/**
 * Authenticated app shell (§10): collapsible dark-navy sidebar with spring
 * collapse, glass topbar with command palette, language switch, notification
 * bell, user menu, and role badge. Fully keyboard accessible.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Bell,
  ChevronsLeft,
  Globe,
  HelpCircle,
  LogOut,
  Menu,
  PlaneTakeoff,
  Search,
  UserCircle2,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n, useT } from "@/components/providers";
import { SPRING_SOFT } from "@/components/motion";
import { navForRole } from "./nav-config";
import { CommandPalette } from "./command-palette";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";

// ─────────────────────── UI state (zustand) ───────────────────────

interface ShellState {
  collapsed: boolean;
  toggle: () => void;
}

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: "hcms-shell" }
  )
);

export interface ShellUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  orgName: string | null;
}

// ─────────────────────────── Sidebar ───────────────────────────

function SidebarNav({
  role,
  collapsed,
  onNavigate,
}: {
  role: Role;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  const pathname = usePathname();
  const groups = React.useMemo(() => navForRole(role), [role]);

  return (
    <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-3">
      {groups.map((group) => (
        <div key={group.labelKey} className="mb-4">
          {!collapsed && (
            <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {t(group.labelKey)}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/portal" && item.href !== "/dashboard" && pathname.startsWith(item.href + "/")) ||
                (item.href === "/portal" && pathname === "/portal");
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors outline-none",
                    "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    active
                      ? "text-white"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center px-0"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      transition={SPRING_SOFT}
                      className="absolute inset-0 rounded-md bg-sidebar-primary"
                      aria-hidden
                    />
                  )}
                  <item.icon className="relative z-10 size-5 shrink-0" aria-hidden />
                  {!collapsed && <span className="relative z-10 truncate">{t(item.labelKey)}</span>}
                </Link>
              );
              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarHeader({ collapsed }: { collapsed: boolean }) {
  const t = useT();
  return (
    <div className={cn("flex h-14 items-center gap-2.5 border-b border-sidebar-border px-3", collapsed && "justify-center px-0")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-white">
        <PlaneTakeoff className="size-5" aria-hidden />
      </span>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-white">{t("app.shortName")}</p>
          <p className="truncate text-[11px] text-sidebar-foreground/60">{t("app.authority")}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Topbar ───────────────────────────

function LanguageSwitch() {
  const { locale, setLocale } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Language / ভাষা">
          <Globe className="size-4" aria-hidden />
          <span className="uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLocale("en")} data-active={locale === "en"}>
          English {locale === "en" && "✓"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale("bn")} data-active={locale === "bn"}>
          বাংলা {locale === "bn" && "✓"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const t = useT();
  const router = useRouter();
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md p-1 pr-2 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring outline-none"
          aria-label={t("common.profile")}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-left leading-tight md:block">
            <span className="block max-w-36 truncate text-sm font-medium">{user.name}</span>
            <span className="block text-[11px] text-muted-foreground">{t(`roles.${user.role}`)}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
          {user.orgName && (
            <p className="mt-0.5 text-xs font-normal text-muted-foreground">{user.orgName}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <UserCircle2 className="size-4" aria-hidden /> {t("common.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <HelpCircle className="size-4" aria-hidden /> {t("common.help")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="size-4" aria-hidden /> {t("common.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────── Shell ───────────────────────────

const SIDEBAR_WIDTH = 248;
const SIDEBAR_COLLAPSED = 64;

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const t = useT();
  const { collapsed, toggle } = useShellStore();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-dvh w-full">
      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH }}
        transition={SPRING_SOFT}
        className="sticky top-0 z-30 hidden h-dvh shrink-0 flex-col bg-sidebar lg:flex"
        aria-label="Sidebar"
      >
        <SidebarHeader collapsed={collapsed} />
        <SidebarNav role={user.role} collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
          >
            <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={SPRING_SOFT}>
              <ChevronsLeft className="size-5" aria-hidden />
            </motion.span>
          </Button>
        </div>
      </motion.aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="glass-surface sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-3 md:px-5">
          {/* Mobile nav */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0 border-sidebar-border">
              <SheetTitle className="sr-only">{t("app.shortName")}</SheetTitle>
              <SidebarHeader collapsed={false} />
              <SidebarNav role={user.role} collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* Command palette trigger */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="inline-flex h-9 w-full max-w-sm items-center gap-2 rounded-md border bg-background/70 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring outline-none"
            aria-label={t("common.search")}
          >
            <Search className="size-4" aria-hidden />
            <span className="truncate">{t("common.search")}…</span>
            <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:block">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <Badge variant="secondary" className="hidden md:inline-flex">
              {t(`roles.${user.role}`)}
            </Badge>
            <LanguageSwitch />
            <NotificationBell />
            <UserMenu user={user} />
          </div>
        </header>

        {/* Page content */}
        <main id="main" className="flex-1 px-3 py-5 md:px-6 lg:px-8">
          <AnimatePresence mode="wait">{children}</AnimatePresence>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={user.role} />
    </div>
  );
}
