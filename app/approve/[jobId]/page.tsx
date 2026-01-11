import crypto from "crypto";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatVehicle } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobEventType, JobState, LineItemStatus } from "@prisma/client";

function hashToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(`${token}${process.env.APP_SECRET ?? ""}`)
    .digest("hex");
}

export default async function ApprovalPage({
  params,
  searchParams
}: {
  params: { jobId: string };
  searchParams: { t?: string };
}) {
  const token = searchParams.t;
  if (!token) {
    return notFound();
  }

  const approval = await prisma.approvalRequest.findUnique({
    where: { jobId: params.jobId },
    include: {
      job: {
        include: {
          shop: true,
          vehicle: true,
          lineItems: true,
          media: true
        }
      }
    }
  });

  if (!approval) {
    return notFound();
  }

  const tokenHash = hashToken(token);
  if (tokenHash !== approval.customerTokenHash) {
    return notFound();
  }

  if (approval.decidedAt) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Decision recorded</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              The request for {approval.job.shop.name} has been {approval.status.toLowerCase()}.
            </p>
            <p className="text-xs text-muted-foreground">
              Decision time: {approval.decidedAt.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (approval.status !== "SENT") {
    return notFound();
  }

  async function decideApproval(formData: FormData) {
    "use server";
    const decision = formData.get("decision");
    if (decision !== "approve" && decision !== "decline") {
      return;
    }

    const current = await prisma.approvalRequest.findUnique({
      where: { jobId: params.jobId },
      include: { job: true }
    });

    if (!current || current.status !== "SENT" || current.decidedAt) {
      return;
    }

    const expectedHash = hashToken(token);
    if (current.customerTokenHash !== expectedHash) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.lineItem.updateMany({
        where: { jobId: params.jobId, status: LineItemStatus.PROPOSED },
        data: { status: decision === "approve" ? LineItemStatus.APPROVED : LineItemStatus.DECLINED }
      });

      await tx.approvalRequest.update({
        where: { jobId: params.jobId },
        data: {
          status: decision === "approve" ? "APPROVED" : "DECLINED",
          decidedAt: new Date()
        }
      });

      await tx.jobEvent.create({
        data: {
          jobId: params.jobId,
          type: JobEventType.APPROVAL_DECIDED,
          payload: { decision }
        }
      });

      if (decision === "approve") {
        await tx.job.update({
          where: { id: params.jobId },
          data: { state: JobState.APPROVED_READY }
        });

        await tx.jobEvent.create({
          data: {
            jobId: params.jobId,
            type: JobEventType.STATE_CHANGE,
            payload: {
              fromState: JobState.WAITING_APPROVAL,
              toState: JobState.APPROVED_READY
            }
          }
        });
      }
    });
  }

  const lineItems = approval.job.lineItems.filter((item) => item.status === LineItemStatus.PROPOSED);
  const total = lineItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{approval.job.shop.name} Approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Vehicle</p>
            <p className="text-sm font-medium">{formatVehicle(approval.job.vehicle)}</p>
            <p className="text-xs text-muted-foreground">{approval.job.title}</p>
          </div>
          <div className="space-y-2">
            {lineItems.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.name} x{item.qty}
                </span>
                <span>{formatCurrency(item.unitPrice * item.qty)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 text-sm font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
          {approval.job.media.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Media</p>
              <ul className="list-disc pl-4 text-xs text-primary">
                {approval.job.media.map((media) => (
                  <li key={media.id}>
                    <a href={media.url} target="_blank">
                      {media.caption || media.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <form action={decideApproval}>
              <input type="hidden" name="decision" value="approve" />
              <Button type="submit">Approve all</Button>
            </form>
            <form action={decideApproval}>
              <input type="hidden" name="decision" value="decline" />
              <Button type="submit" variant="outline">
                Decline all
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">This link expires after a decision is recorded.</p>
    </div>
  );
}
