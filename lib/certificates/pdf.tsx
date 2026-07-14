// Bilingual (EN/BN) certificate + objection letter PDFs — @react-pdf/renderer.
// Server-only: registers Noto Sans Bengali from /public/fonts and renders to Buffer.
// Consumed by app/api/certificates/[id]/pdf and app/api/certificates/objection/[applicationId]/pdf.
import * as React from "react";
import fs from "node:fs";
import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";

// ─────────────────────────────── Fonts ───────────────────────────────

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const BN_REGULAR = path.join(FONT_DIR, "NotoSansBengali-Regular.ttf");
const BN_BOLD = path.join(FONT_DIR, "NotoSansBengali-Bold.ttf");

/** Falls back to Helvetica if the Bengali fonts are missing from /public/fonts. */
const HAS_BENGALI = fs.existsSync(BN_REGULAR);
export const BN_FONT = HAS_BENGALI ? "NotoBengali" : "Helvetica";

if (HAS_BENGALI) {
  Font.register({
    family: "NotoBengali",
    fonts: [
      { src: BN_REGULAR },
      { src: fs.existsSync(BN_BOLD) ? BN_BOLD : BN_REGULAR, fontWeight: "bold" },
    ],
  });
}
// Keep words intact — hyphenation splits Bengali clusters badly.
Font.registerHyphenationCallback((word) => [word]);

// ─────────────────────────── Local formatters ───────────────────────────

/** Decimal degrees → DMS using WinAnsi-safe characters (Helvetica-compatible). */
function dms(value: number, axis: "lat" | "lon"): string {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  const hemi = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${deg}°${String(min).padStart(2, "0")}'${sec.toFixed(1)}"${hemi}`;
}

function coords(lat: number, lon: number): string {
  return `${dms(lat, "lat")}  ${dms(lon, "lon")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fdate(value: Date | string): string {
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const m2 = (v: number) => v.toFixed(2);

// ─────────────────────────────── Styles ───────────────────────────────

const NAVY = "#0f3557";
const INK = "#17242f";
const MUTED = "#5b6b78";
const RULE = "#c9d4dd";
const RED = "#b3261e";

const s = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: 36,
    paddingHorizontal: 46,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: INK,
    lineHeight: 1.4,
  },
  topBand: {
    height: 8,
    marginTop: -42, // cancel page padding — full-bleed to the physical page top
    marginHorizontal: -46,
    marginBottom: 12,
    backgroundColor: NAVY,
  },
  letterhead: { alignItems: "center", marginBottom: 6 },
  govBn: { fontFamily: BN_FONT, fontSize: 9.5, color: MUTED, lineHeight: 1.2 },
  caabEn: { fontFamily: "Helvetica-Bold", fontSize: 15, color: NAVY, letterSpacing: 0.4 },
  caabBn: { fontFamily: BN_FONT, fontSize: 11, color: NAVY, lineHeight: 1.2 },
  address: { fontSize: 8.5, color: MUTED, marginTop: 2 },
  headRule: { height: 1.5, backgroundColor: NAVY, marginBottom: 3 },
  headRuleThin: { height: 0.75, backgroundColor: RULE, marginBottom: 11 },

  titleWrap: { alignItems: "center", marginBottom: 9 },
  titleEn: { fontFamily: "Helvetica-Bold", fontSize: 13, color: NAVY, letterSpacing: 0.8 },
  titleBn: { fontFamily: BN_FONT, fontSize: 10.5, color: NAVY, lineHeight: 1.2 },

  refRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  refText: { fontSize: 9.5 },
  refBold: { fontFamily: "Helvetica-Bold" },

  table: { borderWidth: 1, borderColor: RULE, borderRadius: 2, marginBottom: 10 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: RULE },
  rowLast: { borderBottomWidth: 0 },
  labelCell: {
    width: "34%",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#f2f6f9",
    borderRightWidth: 1,
    borderRightColor: RULE,
  },
  labelEn: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  labelBn: { fontFamily: BN_FONT, fontSize: 8, color: MUTED, lineHeight: 1.2 },
  valueCell: { width: "66%", paddingVertical: 4, paddingHorizontal: 8, justifyContent: "center" },
  value: { fontSize: 9.5 },
  valueBold: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  valueSub: { fontSize: 9, color: MUTED, marginTop: 1 },

  sectionIntroEn: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 2 },
  sectionIntroBn: { fontFamily: BN_FONT, fontSize: 8.5, color: MUTED, lineHeight: 1.2, marginBottom: 4 },
  condRow: { flexDirection: "row", marginBottom: 2, paddingRight: 10 },
  condNum: { width: 16, fontFamily: "Helvetica-Bold", fontSize: 9 },
  condText: { flex: 1, fontSize: 9 },

  para: { fontSize: 9.5, marginBottom: 8, textAlign: "justify" },
  paraBn: { fontFamily: BN_FONT, fontSize: 9.5, marginBottom: 8 },

  regulatory: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 0.75,
    borderTopColor: RULE,
    fontSize: 7.4,
    color: MUTED,
    textAlign: "justify",
  },

  bottomBlock: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  qrWrap: { alignItems: "flex-start", maxWidth: 220 },
  qr: { width: 78, height: 78, marginBottom: 3 },
  qrCaption: { fontSize: 7.5, color: MUTED },
  qrCaptionBn: { fontFamily: BN_FONT, fontSize: 7.5, color: MUTED },
  signWrap: { alignItems: "center", minWidth: 200 },
  signRule: { width: 180, borderTopWidth: 1, borderTopColor: INK, marginBottom: 4 },
  signName: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  signTitleEn: { fontSize: 9 },
  signTitleBn: { fontFamily: BN_FONT, fontSize: 8.5, color: MUTED },
  signDate: { fontSize: 8.5, color: MUTED, marginTop: 3 },

  objBadge: {
    alignSelf: "center",
    borderWidth: 1.2,
    borderColor: RED,
    color: RED,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    paddingVertical: 2,
    paddingHorizontal: 10,
    marginBottom: 10,
    letterSpacing: 1,
  },
  penetration: { fontFamily: "Helvetica-Bold", color: RED },
});

// ─────────────────────────── Shared fragments ───────────────────────────

function Letterhead() {
  return (
    <View>
      <View style={s.letterhead}>
        <Text style={s.govBn}>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</Text>
        <Text style={s.caabEn}>Civil Aviation Authority of Bangladesh</Text>
        <Text style={s.caabBn}>বাংলাদেশ বেসামরিক বিমান চলাচল কর্তৃপক্ষ</Text>
        <Text style={s.address}>Headquarters, Kurmitola, Dhaka-1229, Bangladesh</Text>
      </View>
      <View style={s.headRule} />
      <View style={s.headRuleThin} />
    </View>
  );
}

function Row({
  en,
  bn,
  last,
  children,
}: {
  en: string;
  bn: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={last ? [s.row, s.rowLast] : s.row}>
      <View style={s.labelCell}>
        <Text style={s.labelEn}>{en}</Text>
        <Text style={s.labelBn}>{bn}</Text>
      </View>
      <View style={s.valueCell}>{children}</View>
    </View>
  );
}

function SignatureBlock({ name, date }: { name?: string | null; date: Date | string }) {
  return (
    <View style={s.signWrap} wrap={false}>
      <View style={s.signRule} />
      <Text style={s.signName}>{name ?? "Director (ATM)"}</Text>
      <Text style={s.signTitleEn}>Director (Air Traffic Management)</Text>
      <Text style={s.signTitleBn}>পরিচালক (এটিএম)</Text>
      <Text style={s.signDate}>Date: {fdate(date)}</Text>
    </View>
  );
}

// ─────────────────────────── Certificate PDF ───────────────────────────

export interface CertificatePdfData {
  hcNo: string;
  issuedAt: Date | string;
  applicantName: string;
  authorityName?: string | null;
  structureType: string;
  siteAddress?: string | null;
  lat: number;
  lon: number;
  airportName: string;
  airportIcao: string;
  groundElevationM: number;
  ptE_amslM: number;
  permissibleAglM: number;
  governingSurface?: string | null;
  validFrom: Date | string;
  validTo: Date | string;
  conditions: string[];
  signedByName?: string | null;
  /** PNG data URL produced server-side with the "qrcode" package. */
  qrDataUrl: string;
  /** Human-readable verification URL printed under the QR. */
  verifyUrl: string;
}

export function CertificatePdf({ data }: { data: CertificatePdfData }) {
  return (
    <Document
      title={`Height Clearance Certificate ${data.hcNo}`}
      author="Civil Aviation Authority of Bangladesh"
      subject="Height Clearance Certificate"
    >
      <Page size="A4" style={s.page}>
        <View style={s.topBand} />
        <Letterhead />

        <View style={s.titleWrap}>
          <Text style={s.titleEn}>HEIGHT CLEARANCE CERTIFICATE</Text>
          <Text style={s.titleBn}>উচ্চতা ছাড়পত্র সনদ</Text>
        </View>

        <View style={s.refRow}>
          <Text style={s.refText}>
            HC No: <Text style={s.refBold}>{data.hcNo}</Text>
          </Text>
          <Text style={s.refText}>
            Date: <Text style={s.refBold}>{fdate(data.issuedAt)}</Text>
          </Text>
        </View>

        <View style={s.table}>
          <Row en="Applicant" bn="আবেদনকারী">
            <Text style={s.value}>{data.applicantName}</Text>
          </Row>
          <Row en="Through (Approving Authority)" bn="অনুমোদনকারী কর্তৃপক্ষের মাধ্যমে">
            <Text style={s.value}>{data.authorityName ?? "—"}</Text>
          </Row>
          <Row en="Structure" bn="স্থাপনার ধরন">
            <Text style={s.value}>{data.structureType}</Text>
          </Row>
          <Row en="Site location" bn="স্থাপনার অবস্থান">
            <Text style={s.value}>{data.siteAddress ?? "—"}</Text>
            <Text style={s.valueSub}>{coords(data.lat, data.lon)}</Text>
          </Row>
          <Row en="Airport" bn="বিমানবন্দর">
            <Text style={s.value}>
              {data.airportName} ({data.airportIcao})
            </Text>
          </Row>
          <Row en="Ground elevation" bn="ভূমির উচ্চতা">
            <Text style={s.value}>{m2(data.groundElevationM)} m AMSL</Text>
          </Row>
          <Row en="Permissible top elevation" bn="অনুমোদনযোগ্য সর্বোচ্চ উচ্চতা">
            <Text style={s.valueBold}>{m2(data.ptE_amslM)} m AMSL</Text>
            <Text style={s.valueSub}>{m2(data.permissibleAglM)} m AGL above site ground level</Text>
          </Row>
          <Row en="Governing surface" bn="নিয়ন্ত্রণকারী সারফেস">
            <Text style={s.value}>{data.governingSurface ?? "—"}</Text>
          </Row>
          <Row en="Validity" bn="মেয়াদ" last>
            <Text style={s.value}>
              {fdate(data.validFrom)} {"–"} {fdate(data.validTo)}
            </Text>
          </Row>
        </View>

        <View>
          <Text style={s.sectionIntroEn}>
            This clearance is granted subject to the following conditions:
          </Text>
          <Text style={s.sectionIntroBn}>
            নিম্নলিখিত শর্ত সাপেক্ষে এই ছাড়পত্র প্রদান করা হলো:
          </Text>
          {data.conditions.map((condition, i) => (
            <View key={i} style={s.condRow}>
              <Text style={s.condNum}>{i + 1}.</Text>
              <Text style={s.condText}>{condition}</Text>
            </View>
          ))}
        </View>

        <View style={s.bottomBlock} wrap={false}>
          <View style={s.qrWrap}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image style={s.qr} src={data.qrDataUrl} />
            <Text style={s.qrCaption}>Verify / <Text style={s.qrCaptionBn}>যাচাই</Text>:</Text>
            <Text style={s.qrCaption}>{data.verifyUrl}</Text>
          </View>
          <SignatureBlock name={data.signedByName} date={data.issuedAt} />
        </View>

        <Text style={s.regulatory}>
          Issued under the Civil Aviation Act 2017 and the obstacle control provisions of ICAO
          Annex 14 (Aerodromes, Volume I — Obstacle Limitation Surfaces). Computed values reference
          the aerodrome data published in the CAAB Aeronautical Information Publication (AIP). This
          certificate relates solely to aviation obstacle clearance and does not exempt the holder
          from any other statutory approval. Any alteration renders this certificate void.
        </Text>
      </Page>
    </Document>
  );
}

// ─────────────────────────── Objection letter PDF ───────────────────────────

export interface ObjectionPdfData {
  refNo: string;
  date: Date | string;
  applicantName: string;
  authorityName?: string | null;
  structureType: string;
  siteAddress?: string | null;
  lat: number;
  lon: number;
  airportName: string;
  airportIcao: string;
  requestedHeightAglM: number;
  requestedTopElevationAmslM: number;
  governingSurface?: string | null;
  penetrationM: number;
  ptE_amslM?: number | null;
  permissibleAglM?: number | null;
  signedByName?: string | null;
}

export function ObjectionLetterPdf({ data }: { data: ObjectionPdfData }) {
  return (
    <Document
      title={`Objection — ${data.refNo}`}
      author="Civil Aviation Authority of Bangladesh"
      subject="Objection to Proposed Construction"
    >
      <Page size="A4" style={s.page}>
        <View style={s.topBand} />
        <Letterhead />

        <View style={s.titleWrap}>
          <Text style={s.titleEn}>OBJECTION TO PROPOSED CONSTRUCTION</Text>
          <Text style={s.titleBn}>প্রস্তাবিত নির্মাণে আপত্তি</Text>
        </View>

        <Text style={s.objBadge}>OBJECTION</Text>

        <View style={s.refRow}>
          <Text style={s.refText}>
            Ref: <Text style={s.refBold}>{data.refNo}</Text>
          </Text>
          <Text style={s.refText}>
            Date: <Text style={s.refBold}>{fdate(data.date)}</Text>
          </Text>
        </View>

        <Text style={s.para}>
          With reference to application {data.refNo} submitted by {data.applicantName}
          {data.authorityName ? ` through ${data.authorityName}` : ""} for the proposed{" "}
          {data.structureType.toLowerCase()} at {data.siteAddress ?? "the stated site"} (
          {coords(data.lat, data.lon)}), the Authority has examined the proposal against the
          Obstacle Limitation Surfaces of {data.airportName} ({data.airportIcao}).
        </Text>

        <View style={s.table}>
          <Row en="Requested height" bn="অনুরোধকৃত উচ্চতা">
            <Text style={s.value}>
              {m2(data.requestedHeightAglM)} m AGL ({m2(data.requestedTopElevationAmslM)} m AMSL)
            </Text>
          </Row>
          <Row en="Governing surface" bn="নিয়ন্ত্রণকারী সারফেস">
            <Text style={s.value}>{data.governingSurface ?? "—"}</Text>
          </Row>
          <Row en="Penetration" bn="সারফেস ভেদ">
            <Text style={[s.value, s.penetration]}>{m2(data.penetrationM)} m above the surface</Text>
          </Row>
          <Row en="Permissible alternative" bn="অনুমোদনযোগ্য বিকল্প" last>
            {data.permissibleAglM != null ? (
              <>
                <Text style={s.valueBold}>{m2(data.permissibleAglM)} m AGL</Text>
                {data.ptE_amslM != null && (
                  <Text style={s.valueSub}>{m2(data.ptE_amslM)} m AMSL permissible top elevation</Text>
                )}
              </>
            ) : (
              <Text style={s.value}>{"—"}</Text>
            )}
          </Row>
        </View>

        <Text style={s.para}>
          The proposed construction at the requested height would penetrate the protective surface
          identified above and is therefore OBJECTED TO in the interest of the safety and regularity
          of air navigation. The applicant may revise the proposal to a height not exceeding the
          permissible alternative stated above and resubmit through the approving authority, or may
          request an aeronautical study where grounds exist.
        </Text>
        <Text style={s.paraBn}>
          প্রস্তাবিত উচ্চতায় নির্মাণ কাজ বিমান চলাচলের সুরক্ষা সারফেস ভেদ করবে বিধায় আপত্তি জানানো হলো।
          আবেদনকারী উপরে উল্লিখিত অনুমোদনযোগ্য উচ্চতার মধ্যে সংশোধিত প্রস্তাব পুনরায় দাখিল করতে পারবেন।
        </Text>
        <Text style={s.para}>
          Attention is drawn to the Civil Aviation Act 2017: erection of any structure exceeding the
          permissible height without a valid height clearance from CAAB constitutes an offence and
          may result in removal of the structure at the owner&apos;s expense.
        </Text>

        <View style={[s.bottomBlock, { justifyContent: "flex-end" }]} wrap={false}>
          <SignatureBlock name={data.signedByName} date={data.date} />
        </View>

        <Text style={s.regulatory}>
          Issued under the Civil Aviation Act 2017 and the obstacle control provisions of ICAO Annex
          14 (Aerodromes, Volume I). Computed values reference the aerodrome data published in the
          CAAB Aeronautical Information Publication (AIP).
        </Text>
      </Page>
    </Document>
  );
}

// ─────────────────────────── Render helpers ───────────────────────────

/** QR PNG data URL for the verify link (server-side, "qrcode" package). */
export async function makeQrDataUrl(text: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
    color: { dark: "#17242f", light: "#ffffff" },
  });
}

// NOTE: renderToBuffer must come from the SAME module instance where
// Font.register ran (a dynamic import("@react-pdf/renderer") can resolve the
// dual-package to a second instance with an empty font store).
export async function renderCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
  return renderToBuffer(<CertificatePdf data={data} />);
}

export async function renderObjectionPdf(data: ObjectionPdfData): Promise<Buffer> {
  return renderToBuffer(<ObjectionLetterPdf data={data} />);
}
