// Public landing — hero, feature CTAs, seven-airport strip, how-it-works,
// live stats band. Server component: airports + register counts via Prisma.
import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Building2,
  ClipboardCheck,
  ListChecks,
  MapPinned,
  Mountain,
  Radar,
  Ruler,
  ShieldCheck,
  TowerControl,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getDictionary, translate, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { PageTransition, FadeIn, Stagger, StaggerItem, Pressable } from "@/components/motion";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = {
  description:
    "Civil Aviation Authority of Bangladesh — public height enquiry, certificate verification, obstacle register and application guidelines.",
};

async function getT() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE)?.value === "bn" ? "bn" : "en") as Locale;
  const dict = getDictionary(locale);
  return { t: (path: string) => translate(dict, path), locale };
}

export default async function PublicLandingPage() {
  const { t, locale } = await getT();

  const [airports, obstacleCount, certificateCount] = await Promise.all([
    prisma.airport.findMany({
      where: { active: true },
      orderBy: { icao: "asc" },
      select: {
        id: true,
        icao: true,
        iata: true,
        name: true,
        nameBn: true,
        city: true,
        elevationM: true,
        runways: { select: { designator: true } },
      },
    }),
    prisma.obstacle.count(),
    prisma.certificate.count(),
  ]);

  const features = [
    {
      href: "/height-check",
      icon: Ruler,
      title: t("public.checkHeight"),
      description: t("public.heightCheckSubtitle"),
    },
    {
      href: "/verify",
      icon: BadgeCheck,
      title: t("public.verifyCert"),
      description: t("public.verifySubtitle"),
    },
    {
      href: "/register",
      icon: ListChecks,
      title: t("public.browseRegister"),
      description: t("public.registerSubtitle"),
    },
    {
      href: "/guidelines",
      icon: BookOpen,
      title: t("public.guidelines"),
      description:
        "Who must apply, the approving-authority route, required documents, fees and the regulatory basis.",
    },
  ];

  const steps = [
    {
      icon: Building2,
      title: "Apply via your authority",
      description:
        "Submit through your design-approving authority — RAJUK, CDA, RDA, a city corporation, PWD or your municipality.",
    },
    {
      icon: ClipboardCheck,
      title: "CAAB review",
      description:
        "Intake scrutiny, then multi-discipline review across AGA, CNS and PANS-OPS safeguarding domains.",
    },
    {
      icon: Radar,
      title: "OLS evaluation",
      description:
        "The site is evaluated against ICAO Annex 14 Obstacle Limitation Surfaces to fix the permissible top elevation.",
    },
    {
      icon: Award,
      title: "Certificate",
      description:
        "A bilingual Height Clearance Certificate is issued with a QR code that verifies on this site.",
    },
  ];

  return (
    <PageTransition>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#0c2941] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(30,111,184,0.35),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(22,70,111,0.5),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
          <FadeIn>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide">
              <TowerControl className="size-3.5" aria-hidden />
              {t("app.authority")}
            </p>
          </FadeIn>
          <FadeIn delay={0.06}>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {t("public.heroTitle")}
            </h1>
          </FadeIn>
          <FadeIn delay={0.12}>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
              {t("public.heroSubtitle")}
            </p>
          </FadeIn>
          <FadeIn delay={0.18} className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-white text-[#0c2941] hover:bg-white/90">
              <Link href="/height-check">
                <Ruler className="size-4" aria-hidden />
                {t("public.checkHeight")}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/verify">
                <BadgeCheck className="size-4" aria-hidden />
                {t("public.verifyCert")}
              </Link>
            </Button>
          </FadeIn>

          {/* Feature CTA cards */}
          <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.05}>
            {features.map((feature) => (
              <StaggerItem key={feature.href}>
                <Pressable className="h-full">
                  <Link
                    href={feature.href}
                    className="group flex h-full flex-col rounded-xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm transition-colors hover:border-white/30 hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-white/15 text-white">
                      <feature.icon className="size-5" aria-hidden />
                    </span>
                    <h2 className="text-sm font-semibold">{feature.title}</h2>
                    <p className="mt-1.5 line-clamp-3 flex-1 text-xs leading-relaxed text-white/70">
                      {feature.description}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-white/80 transition-transform group-hover:translate-x-0.5">
                      {t("common.view")}
                      <ArrowRight className="size-3.5" aria-hidden />
                    </span>
                  </Link>
                </Pressable>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── Stats band ── */}
      <section className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.05}>
            <StatCard
              label="Airports safeguarded"
              value={airports.length}
              icon={TowerControl}
              hint={t("common.referenceFigure")}
            />
            <StatCard
              label="System roles"
              value={11}
              icon={Users}
              tone="info"
              hint="Applicant to Director (ATM)"
            />
            <StatCard
              label={t("public.registerTitle")}
              value={obstacleCount}
              icon={MapPinned}
              tone="warning"
              hint="Live register entries"
            />
            <StatCard
              label={t("nav.certificates")}
              value={certificateCount}
              icon={ShieldCheck}
              tone="success"
              hint="Issued and verifiable online"
            />
          </Stagger>
        </div>
      </section>

      {/* ── Seven airports strip ── */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <FadeIn className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Seven safeguarded airports</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Obstacle limitation surfaces are maintained for every operational aerodrome.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
            <Mountain className="size-3.5" aria-hidden />
            {t("common.referenceFigure")}
          </Badge>
        </FadeIn>
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" stagger={0.04}>
          {airports.map((airport) => (
            <StaggerItem key={airport.id}>
              <Card className="h-full gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                    {airport.icao}
                    {airport.iata ? ` · ${airport.iata}` : ""}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {airport.elevationM.toFixed(1)} m AMSL
                  </span>
                </div>
                <p className="text-sm font-medium leading-snug">
                  {locale === "bn" && airport.nameBn ? airport.nameBn : airport.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {airport.city}
                  {airport.runways.length > 0 &&
                    ` · RWY ${airport.runways.map((r) => r.designator).join(", ")}`}
                </p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ── How it works ── */}
      <section className="border-t bg-card">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <FadeIn className="mb-8 text-center">
            <h2 className="text-xl font-semibold tracking-tight">How height clearance works</h2>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
              Applications are routed through your approving authority; CAAB determines the
              permissible top elevation and issues the certificate.
            </p>
          </FadeIn>
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.06}>
            {steps.map((step, index) => (
              <StaggerItem key={step.title}>
                <div className="relative h-full rounded-xl border bg-background p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <step.icon className="size-4.5" aria-hidden />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <FadeIn className="mt-8 text-center">
            <Button asChild variant="outline">
              <Link href="/guidelines">
                <BookOpen className="size-4" aria-hidden />
                {t("public.guidelines")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </FadeIn>
        </div>
      </section>
    </PageTransition>
  );
}
