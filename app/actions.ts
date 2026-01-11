"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { canManageJobs, canTransition, forwardTransitions, requiresReason } from "@/lib/permissions";
import { JobEventType, JobPriority, JobState, LineItemStatus, LineItemType, MediaType } from "@prisma/client";
import { z } from "zod";

const createJobSchema = z.object({
  title: z.string().min(3),
  customerName: z.string().min(2),
  vehicleYear: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleTrim: z.string().optional(),
  priority: z.nativeEnum(JobPriority),
  assignedTechId: z.string().min(1)
});

export async function createJob(formData: FormData) {
  const user = await requireSession();
  if (!canManageJobs(user.role)) {
    redirect("/board");
  }

  const parsed = createJobSchema.parse({
    title: formData.get("title"),
    customerName: formData.get("customerName"),
    vehicleYear: formData.get("vehicleYear"),
    vehicleMake: formData.get("vehicleMake"),
    vehicleModel: formData.get("vehicleModel"),
    vehicleTrim: formData.get("vehicleTrim"),
    priority: formData.get("priority"),
    assignedTechId: formData.get("assignedTechId")
  });

  const assignedTech = await prisma.user.findFirst({
    where: {
      id: parsed.assignedTechId,
      shopId: user.shopId,
      role: "TECH",
      active: true
    }
  });
  if (!assignedTech) {
    throw new Error("Assigned technician is required.");
  }

  const job = await prisma.$transaction(async (tx) => {
    const maxJob = await tx.job.findFirst({
      where: { shopId: user.shopId },
      orderBy: { jobNumber: "desc" },
      select: { jobNumber: true }
    });
    const nextNumber = (maxJob?.jobNumber ?? 1000) + 1;

    const customer = await tx.customer.create({
      data: {
        shopId: user.shopId,
        name: parsed.customerName
      }
    });

    const vehicle = await tx.vehicle.create({
      data: {
        shopId: user.shopId,
        customerId: customer.id,
        year: parsed.vehicleYear ? Number(parsed.vehicleYear) : null,
        make: parsed.vehicleMake || null,
        model: parsed.vehicleModel || null,
        trim: parsed.vehicleTrim || null
      }
    });

    const job = await tx.job.create({
      data: {
        shopId: user.shopId,
        jobNumber: nextNumber,
        customerId: customer.id,
        vehicleId: vehicle.id,
        title: parsed.title,
        state: JobState.CHECKED_IN,
        priority: parsed.priority,
        assignedTechId: parsed.assignedTechId
      }
    });

    await tx.jobEvent.create({
      data: {
        jobId: job.id,
        type: JobEventType.STATE_CHANGE,
        payload: {
          fromState: null,
          toState: JobState.CHECKED_IN
        },
        actorId: user.id
      }
    });

    return job;
  });

  redirect(`/jobs/${job.id}`);
}

const transitionSchema = z.object({
  jobId: z.string().min(1),
  toState: z.nativeEnum(JobState),
  reason: z.string().optional()
});

export async function transitionJob(formData: FormData) {
  const user = await requireSession();
  const parsed = transitionSchema.parse({
    jobId: formData.get("jobId"),
    toState: formData.get("toState"),
    reason: formData.get("reason") || undefined
  });

  const job = await prisma.job.findUnique({
    where: { id: parsed.jobId },
    include: { assignedTech: true }
  });
  if (!job || job.shopId !== user.shopId) {
    redirect("/board");
  }
  if (user.role === "TECH" && job.assignedTechId !== user.id) {
    redirect("/tech");
  }

  if (!canTransition(job.state, parsed.toState)) {
    throw new Error("Invalid transition");
  }
  if (requiresReason(job.state, parsed.toState) && !parsed.reason) {
    throw new Error("Reason required for back transitions");
  }

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: job.id },
      data: {
        state: parsed.toState,
        closedAt: parsed.toState === JobState.CLOSED ? new Date() : undefined
      }
    });

    await tx.jobEvent.create({
      data: {
        jobId: job.id,
        type: JobEventType.STATE_CHANGE,
        payload: {
          fromState: job.state,
          toState: parsed.toState,
          reason: parsed.reason || null
        },
        actorId: user.id
      }
    });
  });

  revalidatePath("/board");
  revalidatePath(`/jobs/${job.id}`);
  revalidatePath("/tech");
}

const noteSchema = z.object({
  jobId: z.string().min(1),
  note: z.string().min(2)
});

export async function addNote(formData: FormData) {
  const user = await requireSession();
  const parsed = noteSchema.parse({
    jobId: formData.get("jobId"),
    note: formData.get("note")
  });

  const job = await prisma.job.findUnique({ where: { id: parsed.jobId } });
  if (!job || job.shopId !== user.shopId) {
    redirect("/board");
  }
  if (user.role === "TECH" && job.assignedTechId !== user.id) {
    redirect("/tech");
  }

  await prisma.jobEvent.create({
    data: {
      jobId: job.id,
      type: JobEventType.NOTE,
      payload: { note: parsed.note },
      actorId: user.id
    }
  });

  revalidatePath(`/jobs/${job.id}`);
}

const lineItemSchema = z.object({
  jobId: z.string().min(1),
  type: z.nativeEnum(LineItemType),
  name: z.string().min(2),
  qty: z.coerce.number().min(1),
  unitPrice: z.coerce.number().min(0),
  laborHours: z.coerce.number().optional(),
  taxable: z.string().optional()
});

export async function addLineItem(formData: FormData) {
  const user = await requireSession();
  if (!canManageJobs(user.role)) {
    redirect("/board");
  }

  const parsed = lineItemSchema.parse({
    jobId: formData.get("jobId"),
    type: formData.get("type"),
    name: formData.get("name"),
    qty: formData.get("qty"),
    unitPrice: formData.get("unitPrice"),
    laborHours: formData.get("laborHours") || undefined,
    taxable: formData.get("taxable") || undefined
  });

  const job = await prisma.job.findUnique({
    where: { id: parsed.jobId },
    include: { lineItems: true }
  });
  if (!job || job.shopId !== user.shopId) {
    redirect("/board");
  }

  const sortOrder = job.lineItems.length + 1;

  await prisma.lineItem.create({
    data: {
      jobId: job.id,
      type: parsed.type,
      name: parsed.name,
      qty: parsed.qty,
      unitPrice: parsed.unitPrice,
      laborHours: parsed.laborHours ? Number(parsed.laborHours) : null,
      taxable: Boolean(parsed.taxable),
      status: LineItemStatus.PROPOSED,
      sortOrder
    }
  });

  revalidatePath(`/jobs/${job.id}`);
}

const assignSchema = z.object({
  jobId: z.string().min(1),
  assignedTechId: z.string().min(1)
});

export async function assignTech(formData: FormData) {
  const user = await requireSession();
  if (!canManageJobs(user.role)) {
    redirect("/board");
  }

  const parsed = assignSchema.parse({
    jobId: formData.get("jobId"),
    assignedTechId: formData.get("assignedTechId")
  });

  const assignedTech = await prisma.user.findFirst({
    where: {
      id: parsed.assignedTechId,
      shopId: user.shopId,
      role: "TECH",
      active: true
    }
  });
  if (!assignedTech) {
    throw new Error("Assigned technician must be active and belong to this shop.");
  }

  const job = await prisma.job.findUnique({ where: { id: parsed.jobId } });
  if (!job || job.shopId !== user.shopId) {
    redirect("/board");
  }

  await prisma.job.update({
    where: { id: job.id },
    data: {
      assignedTechId: parsed.assignedTechId
    }
  });

  revalidatePath(`/jobs/${job.id}`);
  revalidatePath("/board");
  revalidatePath("/tech");
}

const mediaSchema = z.object({
  jobId: z.string().min(1),
  url: z.string().url(),
  caption: z.string().optional(),
  type: z.nativeEnum(MediaType)
});

export async function addMedia(formData: FormData) {
  const user = await requireSession();
  if (!canManageJobs(user.role)) {
    redirect("/board");
  }

  const parsed = mediaSchema.parse({
    jobId: formData.get("jobId"),
    url: formData.get("url"),
    caption: formData.get("caption") || undefined,
    type: formData.get("type")
  });

  const job = await prisma.job.findUnique({ where: { id: parsed.jobId } });
  if (!job || job.shopId !== user.shopId) {
    redirect("/board");
  }

  await prisma.inspectionMedia.create({
    data: {
      jobId: job.id,
      type: parsed.type,
      url: parsed.url,
      caption: parsed.caption || null
    }
  });

  revalidatePath(`/jobs/${job.id}`);
}

const approvalSchema = z.object({
  jobId: z.string().min(1)
});

export async function requestApproval(formData: FormData) {
  const user = await requireSession();
  if (!canManageJobs(user.role)) {
    redirect("/board");
  }

  const parsed = approvalSchema.parse({
    jobId: formData.get("jobId")
  });

  const job = await prisma.job.findUnique({
    where: { id: parsed.jobId },
    include: { approvalRequest: true }
  });
  if (!job || job.shopId !== user.shopId) {
    redirect("/board");
  }
  if (job.state !== JobState.DIAGNOSIS) {
    throw new Error("Job must be in diagnosis to request approval");
  }

  const token = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(`${token}${process.env.APP_SECRET ?? ""}`)
    .digest("hex");

  const url = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/approve/${job.id}?t=${token}`;

  await prisma.$transaction(async (tx) => {
    await tx.approvalRequest.upsert({
      where: { jobId: job.id },
      update: {
        status: "SENT",
        sentAt: new Date(),
        decidedAt: null,
        customerTokenHash: hash
      },
      create: {
        jobId: job.id,
        status: "SENT",
        sentAt: new Date(),
        customerTokenHash: hash
      }
    });

    await tx.jobEvent.create({
      data: {
        jobId: job.id,
        type: JobEventType.APPROVAL_SENT,
        payload: { url },
        actorId: user.id
      }
    });

    await tx.job.update({
      where: { id: job.id },
      data: {
        state: JobState.WAITING_APPROVAL
      }
    });

    await tx.jobEvent.create({
      data: {
        jobId: job.id,
        type: JobEventType.STATE_CHANGE,
        payload: {
          fromState: job.state,
          toState: JobState.WAITING_APPROVAL
        },
        actorId: user.id
      }
    });
  });

  revalidatePath(`/jobs/${job.id}`);
  revalidatePath("/board");
}
