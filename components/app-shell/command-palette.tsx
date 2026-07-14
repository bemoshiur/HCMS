"use client";

// Global command palette (Cmd/Ctrl-K): navigate + search applications.
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileStack, CornerDownLeft } from "lucide-react";
import type { Role } from "@prisma/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useT } from "@/components/providers";
import { navForRole } from "./nav-config";

interface SearchHit {
  id: string;
  refNo: string;
  applicant: string;
  status: string;
  airport: string;
}

export function CommandPalette({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
}) {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const groups = React.useMemo(() => navForRole(role), [role]);

  const { data: hits } = useQuery<SearchHit[]>({
    queryKey: ["palette-search", query],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && query.trim().length >= 2,
    staleTime: 10_000,
  });

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={t("common.search")}>
      <CommandInput
        placeholder={`${t("common.search")}…`}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{t("common.noResults")}</CommandEmpty>
        {hits && hits.length > 0 && (
          <>
            <CommandGroup heading={t("nav.applications")}>
              {hits.map((hit) => (
                <CommandItem
                  key={hit.id}
                  value={`${hit.refNo} ${hit.applicant}`}
                  onSelect={() => go(`/applications/${hit.id}`)}
                >
                  <FileStack className="size-4" aria-hidden />
                  <span className="truncate">{hit.refNo}</span>
                  <span className="truncate text-muted-foreground">— {hit.applicant}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{hit.airport}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {groups.map((group) => (
          <CommandGroup key={group.labelKey} heading={t(group.labelKey)}>
            {group.items.map((item) => (
              <CommandItem key={item.href} value={t(item.labelKey)} onSelect={() => go(item.href)}>
                <item.icon className="size-4" aria-hidden />
                {t(item.labelKey)}
                <CornerDownLeft className="ml-auto size-3.5 opacity-40" aria-hidden />
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
