"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "hcms_aws_onboarding";

// Reads the one-time token from the URL fragment (never sent to any server), then
// strips it from the address bar so it is not bookmarked or shared by accident.
export function OnboardingForm() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const match = /(?:^|&)t=([^&]+)/.exec(window.location.hash.slice(1));
    if (match?.[1]) {
      const value = decodeURIComponent(match[1]);
      try {
        sessionStorage.setItem(STORAGE_KEY, value);
      } catch {
        /* storage unavailable: the in-memory value still works */
      }
      history.replaceState(null, "", window.location.pathname + window.location.search);
      setToken(value);
      return;
    }
    try {
      setToken(sessionStorage.getItem(STORAGE_KEY));
    } catch {
      setToken(null);
    }
  }, []);

  if (token === null) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        Open this page from AWS Marketplace (Manage subscriptions → Set up product) to continue, or email{" "}
        <a className="underline" href="mailto:business@ticonsys.com">
          business@ticonsys.com
        </a>
        .
      </p>
    );
  }

  return (
    <form method="post" action="/api/aws/onboarding" className="mt-6 space-y-4 rounded-lg border p-6">
      <input type="hidden" name="token" value={token} />
      <Field name="organisationName" label="Organisation · প্রতিষ্ঠান" autoComplete="organization" required />
      <Field name="contactName" label="Contact person · যোগাযোগকারী" autoComplete="name" required />
      <Field name="contactEmail" type="email" label="Work email · ইমেইল" autoComplete="email" required />
      <Field name="contactPhone" type="tel" label="Phone (optional) · ফোন" autoComplete="tel" />
      <Field name="country" label="Country · দেশ" autoComplete="country-name" required />
      <Button type="submit">Send to TiCON · পাঠান</Button>
    </form>
  );
}

function Field(props: { name: string; label: string; type?: string; autoComplete?: string; required?: boolean }) {
  const id = `aws-${props.name}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{props.label}</Label>
      <Input
        id={id}
        name={props.name}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        required={props.required}
        maxLength={255}
      />
    </div>
  );
}
