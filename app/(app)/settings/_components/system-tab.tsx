"use client";

// System settings (ADMIN only) — SLA/working days, safeguarding radius,
// certificate validity, feature toggles and notification templates. Each
// section persists a single keyed SystemSetting row and is audited server-side.
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  CreditCard,
  Loader2,
  MessageSquareText,
  Plus,
  Radius,
  ShieldAlert,
  Timer,
  X,
} from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/format";
import { useT } from "@/components/providers";
import {
  fetchJson,
  patchSetting,
  TEMPLATE_EVENTS,
  WEEKDAYS,
  WEEKDAY_LABELS,
  type SettingsPayload,
} from "./types";

// Shared invalidation + toast wiring for a section save.
function useSectionSave() {
  const t = useT();
  const queryClient = useQueryClient();
  return {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: (error: Error) => toast.error(t("common.error"), { description: error.message }),
  };
}

// ───────────────────────── SLA & working days ─────────────────────────

function SlaSection({
  weekend,
  holidays,
  slaPolicy,
}: {
  weekend: string[];
  holidays: string[];
  slaPolicy: { status: string; days: number }[];
}) {
  const handlers = useSectionSave();
  const [days, setDays] = React.useState<Set<string>>(() => new Set(weekend));
  const [dates, setDates] = React.useState<string[]>(() => [...holidays].sort());
  const [newDate, setNewDate] = React.useState("");

  const mutation = useMutation({
    mutationFn: () =>
      patchSetting("sla.workingDays", {
        weekend: WEEKDAYS.filter((d) => days.has(d)),
        holidays: dates,
      }),
    ...handlers,
  });

  const toggleDay = (day: string) =>
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });

  const addHoliday = () => {
    if (!newDate || dates.includes(newDate)) return;
    setDates((prev) => [...prev, newDate].sort());
    setNewDate("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="size-4 text-primary" aria-hidden />
          SLA &amp; working days
        </CardTitle>
        <CardDescription>
          Weekend days and public holidays are excluded when computing business-day SLA due dates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Weekend days</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label
                key={day}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
              >
                <Checkbox checked={days.has(day)} onCheckedChange={() => toggleDay(day)} />
                {WEEKDAY_LABELS[day]}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sla-holiday">Public holidays</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="sla-holiday"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="h-9 w-[10rem]"
            />
            <Button type="button" variant="outline" size="sm" onClick={addHoliday} disabled={!newDate}>
              <Plus className="size-4" aria-hidden />
              Add
            </Button>
          </div>
          {dates.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {dates.map((date) => (
                <span
                  key={date}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs"
                >
                  {formatDate(date)}
                  <button
                    type="button"
                    onClick={() => setDates((prev) => prev.filter((d) => d !== date))}
                    className="rounded-full text-muted-foreground hover:text-destructive focus-visible:outline-2"
                    aria-label={`Remove ${formatDate(date)}`}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No holidays configured.</p>
          )}
        </div>

        {/* Read-only SLA day budgets (from workflow policy) */}
        <div className="space-y-2">
          <Label>SLA day budgets</Label>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 text-right font-medium">Working days</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {slaPolicy.map((row) => (
                  <tr key={row.status}>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{row.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Day budgets are defined by the workflow policy and shown here for reference.
          </p>
        </div>

        <div className="flex justify-end">
          <SaveButton pending={mutation.isPending} onClick={() => mutation.mutate()} />
        </div>
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Numeric single-value sections ─────────────────────────

const radiusSchema = z.object({ value: z.number().min(1, "Must be at least 1 km").max(200) });
const validitySchema = z.object({
  value: z.number().int("Whole years only").min(1, "Must be at least 1 year").max(25),
});

function RadiusSection({ value }: { value: number }) {
  const handlers = useSectionSave();
  const form = useForm<{ value: number }>({
    resolver: zodResolver(radiusSchema),
    mode: "onChange",
    defaultValues: { value },
  });
  const mutation = useMutation({
    mutationFn: (v: number) => patchSetting("safeguarding.radiusKm", { default: v }),
    onSuccess: (_d, v) => {
      form.reset({ value: v });
      handlers.onSuccess();
    },
    onError: handlers.onError,
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Radius className="size-4 text-primary" aria-hidden />
          Safeguarding radius
        </CardTitle>
        <CardDescription>
          Default radius around an aerodrome within which structures are safeguarded and require
          height clearance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((v) => mutation.mutate(v.value))}
          className="flex items-end gap-3"
        >
          <div className="space-y-2">
            <Label htmlFor="safeguarding-radius">Radius (km)</Label>
            <Input
              id="safeguarding-radius"
              type="number"
              step="0.5"
              inputMode="decimal"
              className="w-32"
              aria-invalid={!!form.formState.errors.value}
              {...form.register("value", { valueAsNumber: true })}
            />
            {form.formState.errors.value && (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.value.message}
              </p>
            )}
          </div>
          <SaveButton
            pending={mutation.isPending}
            disabled={!form.formState.isValid || !form.formState.isDirty}
            type="submit"
          />
        </form>
      </CardContent>
    </Card>
  );
}

function ValiditySection({ value }: { value: number }) {
  const handlers = useSectionSave();
  const form = useForm<{ value: number }>({
    resolver: zodResolver(validitySchema),
    mode: "onChange",
    defaultValues: { value },
  });
  const mutation = useMutation({
    mutationFn: (v: number) => patchSetting("certificate.validityYears", { years: v }),
    onSuccess: (_d, v) => {
      form.reset({ value: v });
      handlers.onSuccess();
    },
    onError: handlers.onError,
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Timer className="size-4 text-primary" aria-hidden />
          Certificate validity
        </CardTitle>
        <CardDescription>
          Default validity period applied to newly issued height clearance certificates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((v) => mutation.mutate(v.value))}
          className="flex items-end gap-3"
        >
          <div className="space-y-2">
            <Label htmlFor="certificate-validity">Validity (years)</Label>
            <Input
              id="certificate-validity"
              type="number"
              step="1"
              inputMode="numeric"
              className="w-32"
              aria-invalid={!!form.formState.errors.value}
              {...form.register("value", { valueAsNumber: true })}
            />
            {form.formState.errors.value && (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.value.message}
              </p>
            )}
          </div>
          <SaveButton
            pending={mutation.isPending}
            disabled={!form.formState.isValid || !form.formState.isDirty}
            type="submit"
          />
        </form>
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Feature toggles ─────────────────────────

function BillingSection({ enabled }: { enabled: boolean }) {
  const handlers = useSectionSave();
  const [on, setOn] = React.useState(enabled);
  const mutation = useMutation({
    mutationFn: (next: boolean) => patchSetting("features.billing", { enabled: next }),
    onSuccess: handlers.onSuccess,
    onError: (error: Error, _next, _ctx) => {
      setOn((v) => !v); // revert optimistic toggle
      handlers.onError(error);
    },
  });

  const toggle = (next: boolean) => {
    setOn(next);
    mutation.mutate(next);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="size-4 text-primary" aria-hidden />
          Feature toggles
        </CardTitle>
        <CardDescription>Enable optional modules for this deployment.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium">
              Billing &amp; fees
              <Badge variant={on ? "default" : "secondary"} className="font-normal">
                {on ? "Enabled" : "Disabled"}
              </Badge>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Enables fee invoices on applications. When off, the fee schedule is hidden from
              casework.
            </p>
          </div>
          <Switch
            checked={on}
            onCheckedChange={toggle}
            disabled={mutation.isPending}
            aria-label="Toggle billing and fees"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Notification templates ─────────────────────────

const templatesSchema = z.record(
  z.string(),
  z.object({ email: z.string().max(800), sms: z.string().max(400) })
);
type TemplatesForm = Record<string, { email: string; sms: string }>;

function TemplatesSection({ templates }: { templates: TemplatesForm }) {
  const handlers = useSectionSave();
  const defaults: TemplatesForm = React.useMemo(() => {
    const base: TemplatesForm = {};
    for (const ev of TEMPLATE_EVENTS) {
      base[ev.key] = {
        email: templates[ev.key]?.email ?? "",
        sms: templates[ev.key]?.sms ?? "",
      };
    }
    return base;
  }, [templates]);

  const form = useForm<TemplatesForm>({
    resolver: zodResolver(templatesSchema),
    mode: "onChange",
    defaultValues: defaults,
  });

  const mutation = useMutation({
    mutationFn: (values: TemplatesForm) => patchSetting("notifications.templates", values),
    onSuccess: (_d, values) => {
      form.reset(values);
      handlers.onSuccess();
    },
    onError: handlers.onError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareText className="size-4 text-primary" aria-hidden />
          Notification templates
        </CardTitle>
        <CardDescription>
          Message bodies for key events. Use placeholders{" "}
          <code className="rounded bg-muted px-1 font-mono text-xs">{"{ref}"}</code> for the
          application reference and{" "}
          <code className="rounded bg-muted px-1 font-mono text-xs">{"{hc}"}</code> for the
          certificate number.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-5"
        >
          {TEMPLATE_EVENTS.map((ev) => (
            <div key={ev.key} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[11px]">
                  {ev.key}
                </Badge>
                <span className="text-sm font-medium">{ev.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  Placeholder:{" "}
                  <code className="rounded bg-muted px-1 font-mono">{ev.placeholder}</code>
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`tpl-${ev.key}-email`}>Email</Label>
                  <Textarea
                    id={`tpl-${ev.key}-email`}
                    rows={2}
                    {...form.register(`${ev.key}.email` as const)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`tpl-${ev.key}-sms`}>SMS</Label>
                  <Textarea
                    id={`tpl-${ev.key}-sms`}
                    rows={2}
                    {...form.register(`${ev.key}.sms` as const)}
                  />
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <SaveButton
              pending={mutation.isPending}
              disabled={!form.formState.isDirty}
              type="submit"
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Shared save button ─────────────────────────

function SaveButton({
  pending,
  disabled,
  onClick,
  type = "button",
}: {
  pending: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const t = useT();
  return (
    <Button type={type} onClick={onClick} disabled={pending || disabled}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Check className="size-4" aria-hidden />
      )}
      {pending ? t("common.saving") : t("common.save")}
    </Button>
  );
}

// ───────────────────────── Tab shell ─────────────────────────

export function SystemTab() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetchJson<SettingsPayload>("/api/settings"),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <ShieldAlert className="size-6 text-destructive" aria-hidden />
          <p className="text-sm font-medium">Could not load system settings</p>
          <p className="text-xs text-muted-foreground">{(error as Error)?.message}</p>
        </CardContent>
      </Card>
    );
  }

  const s = data.settings;

  return (
    <Stagger className="grid gap-4 lg:grid-cols-2">
      <StaggerItem className="lg:col-span-2">
        <SlaSection
          weekend={s["sla.workingDays"]?.weekend ?? ["FRI", "SAT"]}
          holidays={s["sla.workingDays"]?.holidays ?? []}
          slaPolicy={data.slaPolicy}
        />
      </StaggerItem>
      <StaggerItem>
        <RadiusSection value={s["safeguarding.radiusKm"]?.default ?? 15} />
      </StaggerItem>
      <StaggerItem>
        <ValiditySection value={s["certificate.validityYears"]?.years ?? 5} />
      </StaggerItem>
      <StaggerItem className="lg:col-span-2">
        <BillingSection enabled={s["features.billing"]?.enabled ?? false} />
      </StaggerItem>
      <StaggerItem className="lg:col-span-2">
        <TemplatesSection templates={s["notifications.templates"] ?? {}} />
      </StaggerItem>
    </Stagger>
  );
}
