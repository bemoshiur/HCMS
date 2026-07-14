"use client";

// Site parameter inputs — lat/lon (2-way synced with the map marker),
// ground elevation and requested height. Live evaluation, no submit button.
import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { Crosshair } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/providers";
import { formatCoords } from "@/lib/format";
import type { SiteFormValues } from "./types";

function FieldError({ message, id }: { message?: string; id: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

export function SiteInputsCard({
  form,
}: {
  form: UseFormReturn<SiteFormValues>;
}) {
  const t = useT();
  const { register, formState, watch } = form;
  const { errors } = formState;
  const lat = watch("lat");
  const lon = watch("lon");
  const hasCoords =
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{t("application.site")}</CardTitle>
        <CardDescription className="text-xs">
          Click the map or drag the marker — coordinates stay in sync. Values
          re-evaluate automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="eval-lat">{t("public.latitude")}</Label>
            <Input
              id="eval-lat"
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="23.843300"
              aria-invalid={!!errors.lat}
              aria-describedby={errors.lat ? "eval-lat-error" : undefined}
              {...register("lat", { valueAsNumber: true })}
            />
            <FieldError id="eval-lat-error" message={errors.lat?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eval-lon">{t("public.longitude")}</Label>
            <Input
              id="eval-lon"
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="90.397800"
              aria-invalid={!!errors.lon}
              aria-describedby={errors.lon ? "eval-lon-error" : undefined}
              {...register("lon", { valueAsNumber: true })}
            />
            <FieldError id="eval-lon-error" message={errors.lon?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eval-ground">{t("public.groundElevation")}</Label>
            <Input
              id="eval-ground"
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="8.0"
              aria-invalid={!!errors.groundElevationM}
              aria-describedby={
                errors.groundElevationM ? "eval-ground-error" : undefined
              }
              {...register("groundElevationM", { valueAsNumber: true })}
            />
            <FieldError
              id="eval-ground-error"
              message={errors.groundElevationM?.message}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eval-height">{t("public.requestedHeight")}</Label>
            <Input
              id="eval-height"
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="45.0"
              aria-invalid={!!errors.requestedHeightAglM}
              aria-describedby={
                errors.requestedHeightAglM ? "eval-height-error" : undefined
              }
              {...register("requestedHeightAglM", { valueAsNumber: true })}
            />
            <FieldError
              id="eval-height-error"
              message={errors.requestedHeightAglM?.message}
            />
          </div>
        </div>
        {hasCoords && (
          <p className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
            <Crosshair className="size-3.5 shrink-0" aria-hidden />
            {formatCoords(lat, lon)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
