// Application workflow engine — legal transitions, SLA policy (§13).
// Every transition must go through applyTransition() so CaseEvents, AuditLogs
// and SLA due dates stay consistent.
import type { ApplicationStatus, Role } from "@prisma/client";

/** Legal state transitions. Key = from, values = allowed to. */
export const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["ENDORSED", "RETURNED_FOR_INFO"],
  ENDORSED: ["INTAKE_SCRUTINY"],
  INTAKE_SCRUTINY: ["UNDER_REVIEW", "RETURNED_FOR_INFO", "REJECTED"],
  UNDER_REVIEW: ["STUDY", "DECISION_PENDING", "RETURNED_FOR_INFO"],
  STUDY: ["DECISION_PENDING"],
  DECISION_PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["CERTIFICATE_ISSUED"],
  REJECTED: [],
  RETURNED_FOR_INFO: ["SUBMITTED"],
  CERTIFICATE_ISSUED: ["REVALIDATION", "EXPIRED", "REVOKED"],
  REVALIDATION: ["CERTIFICATE_ISSUED", "EXPIRED", "REVOKED"],
  EXPIRED: ["REVALIDATION"],
  REVOKED: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Which roles may drive each transition (enforced server-side). */
export const TRANSITION_ROLES: Partial<
  Record<`${ApplicationStatus}->${ApplicationStatus}`, Role[]>
> = {
  "DRAFT->SUBMITTED": ["APPLICANT", "AUTHORITY_OFFICER"],
  "SUBMITTED->ENDORSED": ["AUTHORITY_OFFICER"],
  "SUBMITTED->RETURNED_FOR_INFO": ["AUTHORITY_OFFICER"],
  "ENDORSED->INTAKE_SCRUTINY": ["INTAKE_OFFICER", "ADMIN"],
  "INTAKE_SCRUTINY->UNDER_REVIEW": ["INTAKE_OFFICER", "ADMIN"],
  "INTAKE_SCRUTINY->RETURNED_FOR_INFO": ["INTAKE_OFFICER", "ADMIN"],
  "INTAKE_SCRUTINY->REJECTED": ["INTAKE_OFFICER", "ADMIN"],
  "UNDER_REVIEW->STUDY": ["AGA_REVIEWER", "CNS_REVIEWER", "PANSOPS_REVIEWER", "INTAKE_OFFICER", "ADMIN"],
  "UNDER_REVIEW->DECISION_PENDING": ["INTAKE_OFFICER", "ADMIN", "AGA_REVIEWER", "CNS_REVIEWER", "PANSOPS_REVIEWER"],
  "UNDER_REVIEW->RETURNED_FOR_INFO": ["INTAKE_OFFICER", "ADMIN"],
  "STUDY->DECISION_PENDING": ["STUDY_OFFICER", "ADMIN"],
  "DECISION_PENDING->APPROVED": ["APPROVER"],
  "DECISION_PENDING->REJECTED": ["APPROVER"],
  "APPROVED->CERTIFICATE_ISSUED": ["APPROVER", "ADMIN"],
  "CERTIFICATE_ISSUED->REVALIDATION": ["APPLICANT", "APPROVER", "ADMIN"],
  "CERTIFICATE_ISSUED->EXPIRED": ["ADMIN", "APPROVER"],
  "CERTIFICATE_ISSUED->REVOKED": ["APPROVER", "ADMIN"],
  "REVALIDATION->CERTIFICATE_ISSUED": ["APPROVER", "ADMIN"],
  "RETURNED_FOR_INFO->SUBMITTED": ["APPLICANT", "AUTHORITY_OFFICER"],
  "EXPIRED->REVALIDATION": ["APPLICANT", "ADMIN"],
};

export function roleMayTransition(
  role: Role,
  from: ApplicationStatus,
  to: ApplicationStatus
): boolean {
  if (!canTransition(from, to)) return false;
  const allowed = TRANSITION_ROLES[`${from}->${to}`];
  return allowed ? allowed.includes(role) : role === "ADMIN";
}

/** SLA working-days budget per ACTIVE state (business days). */
export const SLA_DAYS: Partial<Record<ApplicationStatus, number>> = {
  SUBMITTED: 7, // authority endorsement
  ENDORSED: 3, // reach CAAB intake
  INTAKE_SCRUTINY: 5,
  UNDER_REVIEW: 15,
  STUDY: 30,
  DECISION_PENDING: 7,
  REVALIDATION: 10,
};

/** Add business days (skips Fri/Sat — Bangladesh weekend). */
export function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay(); // 5 = Friday, 6 = Saturday
    if (dow !== 5 && dow !== 6) added++;
  }
  return result;
}

/** Compute the SLA due date entering a state (null when the state has no SLA). */
export function slaDueDate(status: ApplicationStatus, entered: Date = new Date()): Date | null {
  const days = SLA_DAYS[status];
  return days ? addBusinessDays(entered, days) : null;
}

/** Statuses that appear in officer work queues. */
export const ACTIVE_STATUSES: ApplicationStatus[] = [
  "SUBMITTED",
  "ENDORSED",
  "INTAKE_SCRUTINY",
  "UNDER_REVIEW",
  "STUDY",
  "DECISION_PENDING",
  "REVALIDATION",
];

/** Ordered workflow steps for the case Stepper UI. */
export const WORKFLOW_STEPS: { status: ApplicationStatus; label: string }[] = [
  { status: "SUBMITTED", label: "Submitted" },
  { status: "ENDORSED", label: "Endorsed" },
  { status: "INTAKE_SCRUTINY", label: "Intake" },
  { status: "UNDER_REVIEW", label: "Review" },
  { status: "DECISION_PENDING", label: "Decision" },
  { status: "CERTIFICATE_ISSUED", label: "Certificate" },
];
