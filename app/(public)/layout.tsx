"use client";

/**
 * Public site shell — glass topbar (brand, section links, sign-in, language
 * switch) + government-serious footer with the demo-data disclaimer.
 * Everything under (public) is reachable unauthenticated.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Languages, LogIn, Menu, TowerControl, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapse } from "@/components/motion";
import { useI18n, useT } from "@/components/providers";
import { cn } from "@/lib/utils";

function useNavItems() {
  const t = useT();
  return [
    { href: "/", label: t("nav.home") },
    { href: "/height-check", label: t("nav.heightCheck") },
    { href: "/verify", label: t("nav.verifyCertificate") },
    { href: "/register", label: t("nav.publicRegister") },
    { href: "/guidelines", label: t("nav.guidelines") },
  ];
}

function LanguageSwitch() {
  const { locale, setLocale } = useI18n();
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("common.language")}>
          <Languages className="size-4" aria-hidden />
          <span className="uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLocale("en")}>
          English
          {locale === "en" && <Check className="ml-auto size-4" aria-hidden />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale("bn")}>
          বাংলা
          {locale === "bn" && <Check className="ml-auto size-4" aria-hidden />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Brand() {
  const t = useT();
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-md focus-visible:outline-2"
      aria-label={t("app.shortName")}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <TowerControl className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-semibold tracking-tight text-foreground">
          {t("app.shortName")}
        </span>
        <span className="hidden text-[11px] text-muted-foreground sm:block">
          {t("app.authority")}
        </span>
      </span>
    </Link>
  );
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const items = useNavItems();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#public-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Topbar */}
      <header className="glass-surface sticky top-0 z-40 border-b print:hidden">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Brand />

          <nav aria-label="Primary" className="ml-6 hidden items-center gap-1 lg:flex">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2",
                  isActive(item.href)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <LanguageSwitch />
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/login">
                <LogIn className="size-4" aria-hidden />
                {t("auth.signIn")}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label={menuOpen ? t("common.close") : "Menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        <Collapse open={menuOpen} className="border-t lg:hidden">
          <nav aria-label="Primary mobile" className="mx-auto max-w-7xl space-y-0.5 px-4 py-3 sm:px-6">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "block rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
            <Button asChild size="sm" className="mt-2 w-full sm:hidden">
              <Link href="/login">
                <LogIn className="size-4" aria-hidden />
                {t("auth.signIn")}
              </Link>
            </Button>
          </nav>
        </Collapse>
      </header>

      {/* Page content */}
      <main id="public-main" className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-sidebar text-sidebar-foreground print:hidden">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white">
                <TowerControl className="size-5" aria-hidden />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-white">{t("app.shortName")}</p>
                <p className="text-xs opacity-80">{t("app.authority")}</p>
              </div>
            </div>
            <p className="max-w-xs text-xs leading-relaxed opacity-75">{t("app.tagline")}</p>
          </div>

          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/90">
              {t("nav.overview")}
            </h2>
            <ul className="space-y-1.5 text-sm">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="rounded-sm opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-2"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/90">
              {t("app.authority")}
            </h2>
            <ul className="space-y-1.5 text-sm opacity-80">
              <li>Headquarters, Kurmitola, Dhaka-1229, Bangladesh</li>
              <li>Air Traffic Management Division</li>
              <li>ICAO Annex 14 · Annex 10 · Doc 8168</li>
              <li>Civil Aviation Act 2017 · CAAB ANO (AD) series</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs opacity-75 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              © {new Date().getFullYear()} {t("app.authority")}
            </p>
            <p className="max-w-xl">{t("app.demoNotice")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
