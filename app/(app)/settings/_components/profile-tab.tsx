"use client";

// Profile settings — available to every role. Display name is editable (RHF),
// email/role/organisation are read-only, and the language preference is applied
// immediately via the i18n context after being persisted to the user record.
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Building2, Check, Globe, Loader2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, useT } from "@/components/providers";
import type { Locale } from "@/lib/i18n";
import { fetchJson, type ProfileInfo } from "./types";

const nameSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120, "Name is too long"),
});
type NameForm = z.infer<typeof nameSchema>;

const LANGUAGES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "bn", label: "বাংলা (Bangla)" },
];

function roleLabel(t: (p: string) => string, role: string): string {
  const label = t(`roles.${role}`);
  return label === `roles.${role}` ? role : label;
}

export function ProfileTab({ profile }: { profile: ProfileInfo }) {
  const t = useT();
  const { locale, setLocale } = useI18n();

  // ── Display name (RHF) ──
  const form = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    mode: "onChange",
    defaultValues: { name: profile.name },
  });
  const { register, formState } = form;

  const nameMutation = useMutation({
    mutationFn: (values: NameForm) =>
      fetchJson<{ profile: { name: string } }>("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name }),
      }),
    onSuccess: (data) => {
      form.reset({ name: data.profile.name });
      toast.success("Profile updated", { description: "Your display name has been saved." });
    },
    onError: (error: Error) => toast.error(t("common.error"), { description: error.message }),
  });

  // ── Language (applied immediately) ──
  const localeMutation = useMutation({
    mutationFn: (next: Locale) =>
      fetchJson("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      }),
    onSuccess: (_data, next) => {
      toast.success("Language updated", { description: "Applying your preference…" });
      // Persist to the i18n cookie and reload so the whole app re-renders.
      setLocale(next);
    },
    onError: (error: Error) => toast.error(t("common.error"), { description: error.message }),
  });

  // ── Notification preferences (demo-only, stored in this session) ──
  const [emailPref, setEmailPref] = React.useState(true);
  const [smsPref, setSmsPref] = React.useState(true);

  return (
    <Stagger className="grid gap-4 lg:grid-cols-2">
      {/* Account details */}
      <StaggerItem className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4 text-primary" aria-hidden />
              Account
            </CardTitle>
            <CardDescription>
              Your identity within the CAAB HCMS. Contact an administrator to change your role or
              organisation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit((values) => nameMutation.mutate(values))}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div className="space-y-2">
                <Label htmlFor="profile-name">Display name</Label>
                <Input
                  id="profile-name"
                  aria-invalid={!!formState.errors.name}
                  {...register("name")}
                />
                {formState.errors.name && (
                  <p className="text-sm text-destructive" role="alert">
                    {formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">
                  <Mail className="size-3.5 text-muted-foreground" aria-hidden />
                  {t("auth.email")}
                </Label>
                <Input
                  id="profile-email"
                  value={profile.email}
                  readOnly
                  disabled
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>
                  <ShieldCheck className="size-3.5 text-muted-foreground" aria-hidden />
                  Role
                </Label>
                <div className="flex h-9 items-center">
                  <Badge variant="secondary">{roleLabel(t, profile.role)}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  <Building2 className="size-3.5 text-muted-foreground" aria-hidden />
                  Organisation
                </Label>
                <div className="flex h-9 items-center text-sm text-muted-foreground">
                  {profile.orgName ?? "—"}
                </div>
              </div>

              <div className="sm:col-span-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={!formState.isValid || !formState.isDirty || nameMutation.isPending}
                >
                  {nameMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="size-4" aria-hidden />
                  )}
                  {nameMutation.isPending ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Language */}
      <StaggerItem>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="size-4 text-primary" aria-hidden />
              {t("common.language")}
            </CardTitle>
            <CardDescription>
              Choose your interface language. The change is applied across the app immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="profile-locale">Interface language</Label>
            <div className="flex items-center gap-2">
              <Select
                value={locale}
                onValueChange={(v) => localeMutation.mutate(v as Locale)}
                disabled={localeMutation.isPending}
              >
                <SelectTrigger id="profile-locale" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {localeMutation.isPending && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
              )}
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Notification preferences */}
      <StaggerItem>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4 text-primary" aria-hidden />
              {t("common.notifications")}
            </CardTitle>
            <CardDescription>
              Channels used for case updates. In-app notifications are always on.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label
              htmlFor="pref-email"
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
            >
              <span className="text-sm font-medium">Email notifications</span>
              <Switch id="pref-email" checked={emailPref} onCheckedChange={setEmailPref} />
            </label>
            <label
              htmlFor="pref-sms"
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
            >
              <span className="text-sm font-medium">SMS notifications</span>
              <Switch id="pref-sms" checked={smsPref} onCheckedChange={setSmsPref} />
            </label>
            <p className="text-xs text-muted-foreground">
              Demo build — channel preferences are illustrative and are not dispatched to a live
              gateway.
            </p>
          </CardContent>
        </Card>
      </StaggerItem>
    </Stagger>
  );
}
