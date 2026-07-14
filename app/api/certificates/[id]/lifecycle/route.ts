// POST /api/certificates/[id]/lifecycle { action: revoke|revalidate|supersede|expire, remarks? }
// Capability-gated (certificate.manage). Keeps the application status in step,
// writes case event + audit and notifies the applicant.
import { z } from "zod";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { applyCertificateLifecycle } from "@/lib/certificates/issue";

const bodySchema = z.object({
  action: z.enum(["revoke", "revalidate", "supersede", "expire"]),
  remarks: z.string().trim().max(2000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCapability("certificate.manage");
    const { id } = await params;
    const body = bodySchema.parse(await request.json());

    const result = await applyCertificateLifecycle({
      actor: user,
      certificateId: id,
      action: body.action,
      remarks: body.remarks,
    });

    return Response.json({
      certificate: result.certificate,
      newCertificate: result.newCertificate ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid request body", issues: error.issues }, { status: 400 });
    }
    return apiError(error);
  }
}
