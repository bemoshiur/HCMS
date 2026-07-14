"use client";

/**
 * Bilingual animated login (§12) with a one-click demo panel for all 11 roles.
 */
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import {
  PlaneTakeoff,
  LockKeyhole,
  Mail,
  Loader2,
  Building2,
  ClipboardCheck,
  FlaskConical,
  Gavel,
  Landmark,
  Radio,
  Route,
  ShieldCheck,
  UserRound,
  Wrench,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Stagger, StaggerItem, FadeIn } from "@/components/motion";
import { useI18n, useT } from "@/components/providers";
import { ROLE_HOME } from "@/lib/auth/permissions";
import type { Role } from "@prisma/client";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

const DEMO_PASSWORD = "Demo@1234";

const DEMO_ACCOUNTS: { email: string; role: Role; icon: typeof UserRound; org: string }[] = [
  { email: "applicant@demo.gov.bd", role: "APPLICANT", icon: UserRound, org: "bti Ltd." },
  { email: "rajuk@demo.gov.bd", role: "AUTHORITY_OFFICER", icon: Landmark, org: "RAJUK" },
  { email: "cda@demo.gov.bd", role: "AUTHORITY_OFFICER", icon: Landmark, org: "CDA" },
  { email: "rda@demo.gov.bd", role: "AUTHORITY_OFFICER", icon: Landmark, org: "RDA" },
  { email: "intake@caab.gov.bd", role: "INTAKE_OFFICER", icon: ClipboardCheck, org: "CAAB" },
  { email: "aga@caab.gov.bd", role: "AGA_REVIEWER", icon: Building2, org: "CAAB AGA" },
  { email: "cns@caab.gov.bd", role: "CNS_REVIEWER", icon: Radio, org: "CAAB CNS" },
  { email: "pansops@caab.gov.bd", role: "PANSOPS_REVIEWER", icon: Route, org: "CAAB PANS-OPS" },
  { email: "director@caab.gov.bd", role: "APPROVER", icon: Gavel, org: "Director ATM" },
  { email: "study@caab.gov.bd", role: "STUDY_OFFICER", icon: FlaskConical, org: "Study Team" },
  { email: "admin@caab.gov.bd", role: "ADMIN", icon: Wrench, org: "CAAB IT" },
  { email: "auditor@caab.gov.bd", role: "AUDITOR", icon: Eye, org: "Oversight" },
];

export function LoginForm() {
  const t = useT();
  const { locale, setLocale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busyEmail, setBusyEmail] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    mode: "onChange",
  });

  const doSignIn = async (values: FormValues, role?: Role) => {
    setBusyEmail(values.email);
    try {
      const result = await signIn("credentials", { ...values, redirect: false });
      if (result?.error) {
        toast.error(t("auth.invalidCredentials"));
        return;
      }
      const callbackUrl = searchParams.get("callbackUrl");
      router.push(callbackUrl ?? (role ? ROLE_HOME[role] : "/dashboard"));
      router.refresh();
    } finally {
      setBusyEmail(null);
    }
  };

  const busy = busyEmail !== null;

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-br from-[#0c2941] via-[#0f3557] to-[#16466f] px-4 py-10">
      {/* Subtle animated accent — the single tasteful flourish */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[#1e6fb8]/20 blur-3xl"
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_1.1fr]">
        {/* Brand + credentials */}
        <FadeIn>
          <Card className="h-full p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <PlaneTakeoff className="size-6" aria-hidden />
              </span>
              <div className="leading-tight">
                <p className="font-semibold">{t("auth.portalTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("app.authority")}</p>
              </div>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight">{t("auth.welcomeBack")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("auth.signInSubtitle")}</p>

            <form
              className="mt-6 space-y-4"
              onSubmit={form.handleSubmit((values) => doSignIn(values))}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.gov.bd"
                    className="pl-9"
                    aria-invalid={!!form.formState.errors.email}
                    {...form.register("email")}
                  />
                </div>
                {form.formState.errors.email && (
                  <p role="alert" className="text-xs text-destructive">
                    {t("auth.email")} — {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pl-9"
                    aria-invalid={!!form.formState.errors.password}
                    {...form.register("password")}
                  />
                </div>
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!form.formState.isValid || busy}
              >
                {busy && busyEmail === form.getValues("email") ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden /> {t("auth.signingIn")}
                  </>
                ) : (
                  t("auth.signIn")
                )}
              </Button>
            </form>

            <Separator className="my-6" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => setLocale(locale === "en" ? "bn" : "en")}
                className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2"
              >
                {locale === "en" ? "বাংলায় দেখুন" : "View in English"}
              </button>
              <span>{t("app.demoNotice").split("—")[0]}</span>
            </div>
          </Card>
        </FadeIn>

        {/* Demo accounts */}
        <FadeIn delay={0.08}>
          <Card className="h-full p-6">
            <div className="mb-4">
              <h2 className="font-semibold">{t("auth.demoAccounts")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("auth.demoHint")}{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{DEMO_PASSWORD}</code>
              </p>
            </div>
            <Stagger stagger={0.035} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((account) => (
                <StaggerItem key={account.email}>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    disabled={busy}
                    onClick={() =>
                      doSignIn({ email: account.email, password: DEMO_PASSWORD }, account.role)
                    }
                    className="flex w-full items-center gap-3 rounded-md border bg-background px-3 py-2.5 text-left transition-colors hover:border-ring hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring outline-none disabled:opacity-60"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                      {busyEmail === account.email ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <account.icon className="size-4" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate text-sm font-medium">
                        {t(`roles.${account.role}`)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {account.org} · {account.email}
                      </span>
                    </span>
                  </motion.button>
                </StaggerItem>
              ))}
            </Stagger>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
