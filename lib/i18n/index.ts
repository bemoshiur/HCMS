// Lightweight bilingual dictionary (en / bn) — no middleware, cookie-persisted.
// Server: getDictionary(locale). Client: useT() from components/providers.
import { en, type Dictionary } from "./dictionaries/en";
import { bn } from "./dictionaries/bn";

export type Locale = "en" | "bn";
export type { Dictionary };

export const LOCALE_COOKIE = "hcms-locale";

const dictionaries: Record<Locale, Dictionary> = { en, bn };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}

/** Dot-path lookup with English fallback: translate(dict, "nav.dashboard") */
export function translate(dict: Dictionary, path: string): string {
  const resolve = (d: unknown): string | undefined => {
    let node: unknown = d;
    for (const part of path.split(".")) {
      if (node == null || typeof node !== "object") return undefined;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === "string" ? node : undefined;
  };
  return resolve(dict) ?? resolve(en) ?? path;
}
