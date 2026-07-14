// Wizard form schema (RHF + Zod) and per-step field groupings.
import { z } from "zod";

export const wizardSchema = z.object({
  // Step 1 — applicant
  contactPerson: z
    .string("Enter the contact person")
    .trim()
    .min(3, "Enter the contact person's full name")
    .max(120),
  contactPhone: z
    .string("Enter a contact phone number")
    .trim()
    .min(6, "Enter a valid phone number")
    .max(30)
    .regex(/^[+0-9()\-\s]+$/, "Digits, spaces and + - ( ) only"),
  contactEmail: z
    .string("Enter a contact email")
    .trim()
    .min(5, "Enter a valid email address")
    .max(160)
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address"),

  // Step 2 — site
  icao: z.string("Select an airport").min(3, "Select an airport").max(4),
  lat: z
    .number("Set the site on the map or enter a latitude")
    .min(-90, "Must be between −90 and 90")
    .max(90, "Must be between −90 and 90"),
  lon: z
    .number("Set the site on the map or enter a longitude")
    .min(-180, "Must be between −180 and 180")
    .max(180, "Must be between −180 and 180"),
  groundElevationM: z
    .number("Enter the ground elevation")
    .min(-100, "Minimum −100 m")
    .max(2000, "Maximum 2,000 m"),
  siteAddress: z
    .string("Enter the site address")
    .trim()
    .min(5, "Enter the site address (plot, road, area)")
    .max(300),

  // Step 3 — structure
  structureType: z.string("Select a structure type").min(2, "Select a structure type").max(80),
  requestedHeightAglM: z
    .number("Enter the proposed height")
    .min(0.1, "Must be more than 0 m")
    .max(1000, "Maximum 1,000 m"),
  purpose: z.string().trim().max(2000, "Maximum 2,000 characters").optional(),

  // Step 5 — review & submit
  authorityOrgId: z.string("Select the approving authority").min(1, "Select the approving authority"),
  declaration: z.boolean().refine((v) => v === true, "Please confirm the declaration"),
});

export type WizardValues = z.infer<typeof wizardSchema>;

/** Fields validated per step (documents step validates via upload state). */
export const STEP_FIELDS: (keyof WizardValues)[][] = [
  ["contactPerson", "contactPhone", "contactEmail"],
  ["icao", "lat", "lon", "groundElevationM", "siteAddress"],
  ["structureType", "requestedHeightAglM", "purpose"],
  [],
  ["authorityOrgId", "declaration"],
];

export const STEP_LABELS = ["Applicant", "Site", "Structure", "Documents", "Review"] as const;

export function stepSchema(step: number) {
  const fields = STEP_FIELDS[step];
  if (fields.length === 0) return null;
  const shape = Object.fromEntries(fields.map((f) => [f, true])) as Record<
    keyof WizardValues,
    true
  >;
  return wizardSchema.pick(shape);
}
