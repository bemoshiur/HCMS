"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MotionProvider } from "@/components/motion";
import { LOCALE_COOKIE, translate, type Dictionary, type Locale } from "@/lib/i18n";

// ───────────────────────────── i18n context ─────────────────────────────

type I18nContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  t: (path: string) => string;
  setLocale: (locale: Locale) => void;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <Providers>");
  return ctx;
}

/** Shorthand translation hook: const t = useT(); t("nav.dashboard") */
export function useT(): (path: string) => string {
  return useI18n().t;
}

// ───────────────────────────── Providers ─────────────────────────────

export function Providers({
  children,
  locale,
  dictionary,
}: {
  children: React.ReactNode;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      })
  );

  const setLocale = React.useCallback((next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    // Full reload so the server layout re-renders with the new dictionary
    window.location.reload();
  }, []);

  const t = React.useCallback(
    (path: string) => translate(dictionary, path),
    [dictionary]
  );

  const i18nValue = React.useMemo(
    () => ({ locale, dictionary, t, setLocale }),
    [locale, dictionary, t, setLocale]
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <I18nContext.Provider value={i18nValue}>
          <MotionProvider>
            <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
            <Toaster position="top-right" richColors closeButton />
          </MotionProvider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
