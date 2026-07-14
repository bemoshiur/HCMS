import type { Metadata } from "next";
import { Public_Sans, Noto_Sans_Bengali, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";
import { getDictionary, type Locale } from "@/lib/i18n";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

const notoBengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CAAB Height Clearance Management System",
    template: "%s · CAAB HCMS",
  },
  description:
    "Civil Aviation Authority of Bangladesh — aviation height clearance: public height enquiry, applications, OLS evaluation, certificates and obstacle register.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("hcms-locale")?.value === "bn" ? "bn" : "en") as Locale;
  const dictionary = getDictionary(locale);

  return (
    <html
      lang={locale}
      className={cn(
        "h-full antialiased",
        publicSans.variable,
        notoBengali.variable,
        geistMono.variable
      )}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers locale={locale} dictionary={dictionary}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
