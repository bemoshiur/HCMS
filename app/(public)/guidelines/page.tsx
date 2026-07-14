// Application guidelines — who must apply, authority routing, documents,
// process, regulatory basis, fees and FAQ. Server component (cookie locale).
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  AlertTriangle,
  Banknote,
  BookOpen,
  Building2,
  FileCheck2,
  FileText,
  Landmark,
  Layers,
  ListOrdered,
  Map as MapIcon,
  MountainSnow,
  Radar,
  Ruler,
  Scale,
  ScrollText,
  Stamp,
} from "lucide-react";
import { getDictionary, translate, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { PageTransition, FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Guidelines" };

// Approving authorities directory (mirrors seeded master data).
const AUTHORITIES: Array<{ name: string; nameBn: string; code: string; area: string }> = [
  { name: "Rajdhani Unnayan Kartripakkha (RAJUK)", nameBn: "রাজধানী উন্নয়ন কর্তৃপক্ষ (রাজউক)", code: "RAJUK", area: "Dhaka" },
  { name: "Dhaka North City Corporation", nameBn: "ঢাকা উত্তর সিটি কর্পোরেশন", code: "DNCC", area: "Dhaka" },
  { name: "Dhaka South City Corporation", nameBn: "ঢাকা দক্ষিণ সিটি কর্পোরেশন", code: "DSCC", area: "Dhaka" },
  { name: "Chattogram Development Authority (CDA)", nameBn: "চট্টগ্রাম উন্নয়ন কর্তৃপক্ষ (সিডিএ)", code: "CDA", area: "Chattogram" },
  { name: "Chattogram City Corporation", nameBn: "চট্টগ্রাম সিটি কর্পোরেশন", code: "CCC", area: "Chattogram" },
  { name: "Sylhet Development Authority", nameBn: "সিলেট উন্নয়ন কর্তৃপক্ষ", code: "SDA", area: "Sylhet" },
  { name: "Sylhet City Corporation", nameBn: "সিলেট সিটি কর্পোরেশন", code: "SCC", area: "Sylhet" },
  { name: "Cox's Bazar Development Authority", nameBn: "কক্সবাজার উন্নয়ন কর্তৃপক্ষ", code: "CXDA", area: "Cox's Bazar" },
  { name: "Cox's Bazar Municipality", nameBn: "কক্সবাজার পৌরসভা", code: "CXM", area: "Cox's Bazar" },
  { name: "Jashore Municipality (Pourashava)", nameBn: "যশোর পৌরসভা", code: "JSM", area: "Jashore" },
  { name: "Rajshahi Development Authority (RDA)", nameBn: "রাজশাহী উন্নয়ন কর্তৃপক্ষ (আরডিএ)", code: "RDA", area: "Rajshahi" },
  { name: "Rajshahi City Corporation", nameBn: "রাজশাহী সিটি কর্পোরেশন", code: "RCC", area: "Rajshahi" },
  { name: "Public Works Department (PWD)", nameBn: "গণপূর্ত অধিদপ্তর", code: "PWD", area: "Nationwide" },
  { name: "Bangladesh Hi-Tech Park Authority", nameBn: "বাংলাদেশ হাই-টেক পার্ক কর্তৃপক্ষ", code: "BHTPA", area: "Nationwide" },
];

const DOCUMENTS = [
  {
    icon: ScrollText,
    title: "Proof of ownership",
    description: "Registered deed, khatian / porcha or lease agreement for the plot.",
  },
  {
    icon: MapIcon,
    title: "Mouza map",
    description: "RS/BS mouza sheet with the plot clearly marked and attested.",
  },
  {
    icon: Layers,
    title: "Approved site plan",
    description: "Site and layout plan endorsed by the approving authority.",
  },
  {
    icon: MountainSnow,
    title: "Elevation certificate",
    description:
      "Ground elevation (m AMSL) certified by a licensed surveyor, referenced to a national benchmark.",
  },
  {
    icon: FileText,
    title: "Structural drawings",
    description:
      "Elevation view showing the total top height including lift rooms, water tanks, masts and lightning arresters.",
  },
  {
    icon: Stamp,
    title: "Authority forwarding letter",
    description: "Endorsement / forwarding letter from your design-approving authority.",
  },
];

const PROCESS_STEPS = [
  {
    title: "Prepare the application",
    description:
      "Collect the required documents and confirm the site coordinates (WGS-84) and ground elevation. Use the public Height Check for an indicative result first.",
  },
  {
    title: "Submit to your approving authority",
    description:
      "File the application with RAJUK, CDA, RDA, your city corporation, municipality, union parishad or PWD — CAAB does not accept applications directly from the public.",
  },
  {
    title: "Endorsement and forwarding",
    description:
      "The authority scrutinises the file, endorses it and forwards it to CAAB Air Traffic Management Division.",
  },
  {
    title: "CAAB evaluation",
    description:
      "Intake scrutiny, automatic OLS evaluation under ICAO Annex 14, and discipline review across AGA, CNS and PANS-OPS. Penetrating cases may be referred to an aeronautical study.",
  },
  {
    title: "Decision and certificate",
    description:
      "CAAB issues a bilingual Height Clearance Certificate with the permissible top elevation and QR verification — or an objection letter stating the permissible alternative.",
  },
];

const REGULATIONS = [
  {
    icon: Radar,
    title: "ICAO Annex 14, Volume I",
    description: "Aerodrome design and operations — Obstacle Limitation Surfaces (AGA).",
  },
  {
    icon: Radar,
    title: "ICAO Annex 10",
    description: "Aeronautical telecommunications — protection of CNS navigation aids.",
  },
  {
    icon: BookOpen,
    title: "ICAO Doc 8168 (PANS-OPS)",
    description: "Procedures for air navigation services — instrument flight procedure surfaces.",
  },
  {
    icon: Scale,
    title: "Civil Aviation Act, 2017",
    description: "Statutory basis for CAAB's height clearance and obstacle control mandate.",
  },
  {
    icon: Landmark,
    title: "CAAB ANO (AD) series",
    description: "Air Navigation Orders on aerodrome standards and obstacle restriction.",
  },
];

const FEES = [
  { band: "Up to 50 m AGL", fee: "BDT 5,000", examples: "Typical residential and commercial buildings" },
  { band: "Above 50 m up to 150 m AGL", fee: "BDT 15,000", examples: "High-rise buildings, greenfield telecom towers" },
  { band: "Above 150 m AGL", fee: "BDT 30,000", examples: "Chimneys, broadcast masts, special structures" },
];

const FAQ = [
  {
    q: "Do I need height clearance for a rooftop telecom tower?",
    a: "Yes. The assessed height is the total top elevation — building plus tower, antennas and lightning arrester. If the site lies under an Obstacle Limitation Surface, clearance is required before installation.",
  },
  {
    q: "Can I apply to CAAB directly?",
    a: "No. Applications are routed through your design-approving authority (RAJUK, CDA, RDA, a city corporation, municipality, union parishad or PWD), which endorses and forwards the file to CAAB.",
  },
  {
    q: "How is the permissible height determined?",
    a: "The permissible top elevation is the lowest limit across three safeguarding domains: Annex 14 Obstacle Limitation Surfaces (AGA), navigation-aid protection (CNS) and instrument procedure surfaces (PANS-OPS).",
  },
  {
    q: "What happens if my proposal penetrates a surface?",
    a: "CAAB either issues an objection letter stating the permissible alternative height, or — where justified — conducts an aeronautical study that may allow the structure with conditions such as marking and lighting.",
  },
  {
    q: "How long is a certificate valid?",
    a: "The validity period is stated on the certificate. Construction must reach the certified height within that period; otherwise apply for revalidation through the same authority.",
  },
  {
    q: "How do I verify a certificate?",
    a: "Scan the QR code on the certificate or enter the HC number on the Verify Certificate page. The register of cleared structures is also public.",
  },
];

export default async function GuidelinesPage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE)?.value === "bn" ? "bn" : "en") as Locale;
  const dict = getDictionary(locale);
  const t = (path: string) => translate(dict, path);

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <PageHeader
          crumbs={[{ label: t("nav.home"), href: "/" }, { label: t("nav.guidelines") }]}
          title={t("public.guidelines")}
          description="Everything you need to apply for aviation height clearance for buildings, towers, chimneys and masts near Bangladesh's airports."
        />

        <div className="space-y-10">
          {/* ── Who must apply ── */}
          <section aria-labelledby="who-must-apply">
            <SectionHeading id="who-must-apply" icon="ruler" title="Who must apply" />
            <FadeIn>
              <Card className="gap-3 p-5">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Height clearance is required before constructing or extending any structure that
                  may affect aviation safety near an aerodrome, including:
                </p>
                <ul className="grid gap-2 text-sm sm:grid-cols-2">
                  {[
                    "Buildings within the obstacle limitation surfaces of an airport (roughly 15 km around the aerodrome, farther under approach and take-off paths)",
                    "Telecom towers, masts and antennas — greenfield or rooftop",
                    "Chimneys, silos, overhead water tanks and transmission-line towers",
                    "Temporary tall equipment such as construction cranes",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Building2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Alert>
                  <AlertTriangle className="size-4" aria-hidden />
                  <AlertTitle>Not sure whether your site is affected?</AlertTitle>
                  <AlertDescription>
                    Run the free indicative check first — it shows the governing surface and the
                    permissible height at your exact coordinates.{" "}
                    <Link href="/height-check" className="font-medium text-info underline underline-offset-2">
                      {t("public.checkHeight")}
                    </Link>
                  </AlertDescription>
                </Alert>
              </Card>
            </FadeIn>
          </section>

          {/* ── Approving authorities ── */}
          <section aria-labelledby="authority-routing">
            <SectionHeading
              id="authority-routing"
              icon="landmark"
              title="Apply through your approving authority"
              description="CAAB does not accept applications directly from the public. Submit to the authority that approves designs in your area; it endorses and forwards the file to CAAB."
            />
            <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" stagger={0.03}>
              {AUTHORITIES.map((authority) => (
                <StaggerItem key={authority.code}>
                  <Card className="h-full gap-1.5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                        {authority.code}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {authority.area}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium leading-snug">
                      {locale === "bn" ? authority.nameBn : authority.name}
                    </p>
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
          </section>

          {/* ── Required documents ── */}
          <section aria-labelledby="required-documents">
            <SectionHeading
              id="required-documents"
              icon="file"
              title="Required documents"
              description="Incomplete files are returned by the approving authority — attach all of the following."
            />
            <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" stagger={0.03}>
              {DOCUMENTS.map((doc) => (
                <StaggerItem key={doc.title}>
                  <Card className="h-full gap-2 p-4">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <doc.icon className="size-4.5" aria-hidden />
                    </span>
                    <p className="text-sm font-semibold">{doc.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{doc.description}</p>
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
          </section>

          {/* ── Process ── */}
          <section aria-labelledby="process-steps">
            <SectionHeading id="process-steps" icon="list" title="The process, step by step" />
            <FadeIn>
              <Card className="p-5">
                <ol className="space-y-0">
                  {PROCESS_STEPS.map((step, index) => (
                    <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
                      {index < PROCESS_STEPS.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-border"
                        />
                      )}
                      <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {index + 1}
                      </span>
                      <div className="pt-1">
                        <p className="text-sm font-semibold">{step.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            </FadeIn>
          </section>

          {/* ── Regulatory basis ── */}
          <section aria-labelledby="regulatory-basis">
            <SectionHeading
              id="regulatory-basis"
              icon="scale"
              title="Regulatory basis"
              description="Height clearance determinations are made under the following instruments."
            />
            <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" stagger={0.03}>
              {REGULATIONS.map((reg) => (
                <StaggerItem key={reg.title}>
                  <Card className="h-full gap-2 p-4">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <reg.icon className="size-4.5" aria-hidden />
                    </span>
                    <p className="text-sm font-semibold">{reg.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{reg.description}</p>
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
          </section>

          {/* ── Fees ── */}
          <section aria-labelledby="fee-schedule">
            <SectionHeading
              id="fee-schedule"
              icon="banknote"
              title="Fee schedule"
              description={t("common.referenceFigure")}
            />
            <FadeIn>
              <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Structure height band</TableHead>
                        <TableHead>Processing fee</TableHead>
                        <TableHead className="hidden sm:table-cell">Typical structures</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {FEES.map((fee) => (
                        <TableRow key={fee.band}>
                          <TableCell className="font-medium">{fee.band}</TableCell>
                          <TableCell className="font-semibold tabular-nums text-primary">
                            {fee.fee}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">
                            {fee.examples}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="border-t px-4 py-3 text-xs text-muted-foreground">
                  Fees are deposited through your approving authority (treasury challan / bank
                  draft in favour of CAAB). Revalidation attracts the same band.
                </p>
              </Card>
            </FadeIn>
          </section>

          {/* ── FAQ ── */}
          <section aria-labelledby="faq">
            <SectionHeading id="faq" icon="help" title="Frequently asked questions" />
            <FadeIn>
              <Card className="p-2 sm:p-4">
                <Accordion type="single" collapsible className="w-full">
                  {FAQ.map((item, index) => (
                    <AccordionItem key={item.q} value={`faq-${index}`}>
                      <AccordionTrigger className="text-left text-sm font-medium">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>
            </FadeIn>
          </section>

          {/* ── CTA ── */}
          <FadeIn className="flex flex-wrap items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center">
            <div className="w-full">
              <p className="text-sm font-semibold">Ready to check your site?</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("public.disclaimer")}</p>
            </div>
            <Button asChild>
              <Link href="/height-check">
                <Ruler className="size-4" aria-hidden />
                {t("public.checkHeight")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/verify">
                <FileCheck2 className="size-4" aria-hidden />
                {t("public.verifyCert")}
              </Link>
            </Button>
          </FadeIn>
        </div>
      </div>
    </PageTransition>
  );
}

// Small server-side section heading (icon name → lucide component).
function SectionHeading({
  id,
  icon,
  title,
  description,
}: {
  id: string;
  icon: "ruler" | "landmark" | "file" | "list" | "scale" | "banknote" | "help";
  title: string;
  description?: string;
}) {
  const Icon =
    icon === "ruler"
      ? Ruler
      : icon === "landmark"
        ? Landmark
        : icon === "file"
          ? FileText
          : icon === "list"
            ? ListOrdered
            : icon === "scale"
              ? Scale
              : icon === "banknote"
                ? Banknote
                : BookOpen;
  return (
    <div className="mb-4">
      <h2 id={id} className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Icon className="size-5 text-primary" aria-hidden />
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
