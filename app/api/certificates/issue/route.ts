// POST /api/certificates/issue { applicationId, validityYears? }
// Issues a GRANTED certificate for an APPROVED application (APPROVER/ADMIN).
import { z } from "zod";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { issueCertificate } from "@/lib/certificates/issue";

const bodySchema = z.object({
  applicationId: z.string().min(1),
  validityYears: z.number().int().min(1).max(10).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireCapability("certificate.manage");
    const body = bodySchema.parse(await request.json());

    const certificate = await issueCertificate({
      actor: user,
      applicationId: body.applicationId,
      validityYears: body.validityYears,
    });

    return Response.json({ certificate }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid request body", issues: error.issues }, { status: 400 });
    }
    return apiError(error);
  }
}
