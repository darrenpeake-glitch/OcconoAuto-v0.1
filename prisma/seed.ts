import { PrismaClient, JobEventType, JobPriority, JobState, LineItemStatus, LineItemType, MediaType, ApprovalStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.jobEvent.deleteMany();
  await prisma.lineItem.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.inspectionMedia.deleteMany();
  await prisma.job.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.shop.deleteMany();

  const shop = await prisma.shop.create({
    data: {
      name: "OcconoAuto",
      timezone: "America/Chicago"
    }
  });

  const passwordHash = await bcrypt.hash("password", 10);

  const owner = await prisma.user.create({
    data: {
      shopId: shop.id,
      name: "Olivia Owner",
      email: "owner@occonoauto.test",
      passwordHash,
      role: UserRole.OWNER
    }
  });

  const advisor = await prisma.user.create({
    data: {
      shopId: shop.id,
      name: "Andy Advisor",
      email: "advisor@occonoauto.test",
      passwordHash,
      role: UserRole.ADVISOR
    }
  });

  const tech = await prisma.user.create({
    data: {
      shopId: shop.id,
      name: "Tess Tech",
      email: "tech@occonoauto.test",
      passwordHash,
      role: UserRole.TECH
    }
  });

  const customer = await prisma.customer.create({
    data: {
      shopId: shop.id,
      name: "Jordan Lee",
      phone: "555-0139",
      email: "jordan@example.com"
    }
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      shopId: shop.id,
      customerId: customer.id,
      year: 2018,
      make: "Toyota",
      model: "Camry",
      trim: "SE",
      vin: "1HGBH41JXMN109186",
      plate: "OCC-124",
      odometer: 52310
    }
  });

  const baseJobs = [
    {
      title: "Brake noise diagnosis",
      state: JobState.CHECKED_IN,
      priority: JobPriority.NORMAL,
      assignedTechId: tech.id
    },
    {
      title: "AC not cooling",
      state: JobState.DIAGNOSIS,
      priority: JobPriority.HIGH,
      assignedTechId: tech.id
    },
    {
      title: "Oil change + inspection",
      state: JobState.WAITING_APPROVAL,
      priority: JobPriority.NORMAL,
      assignedTechId: tech.id
    },
    {
      title: "Tire rotation",
      state: JobState.APPROVED_READY,
      priority: JobPriority.LOW,
      assignedTechId: tech.id
    },
    {
      title: "Suspension repair",
      state: JobState.IN_REPAIR,
      priority: JobPriority.HIGH,
      assignedTechId: tech.id
    },
    {
      title: "Parts on order",
      state: JobState.WAITING_PARTS,
      priority: JobPriority.NORMAL,
      assignedTechId: tech.id
    },
    {
      title: "Final QC",
      state: JobState.QUALITY_CHECK,
      priority: JobPriority.NORMAL,
      assignedTechId: tech.id
    },
    {
      title: "Ready for pickup",
      state: JobState.READY_PICKUP,
      priority: JobPriority.NORMAL,
      assignedTechId: tech.id
    }
  ];

  let jobNumber = 1001;
  const jobs = [];
  for (const jobData of baseJobs) {
    const job = await prisma.job.create({
      data: {
        shopId: shop.id,
        jobNumber,
        customerId: customer.id,
        vehicleId: vehicle.id,
        title: jobData.title,
        state: jobData.state,
        priority: jobData.priority,
        assignedTechId: jobData.assignedTechId
      }
    });
    jobs.push(job);
    jobNumber += 1;
  }

  await prisma.lineItem.createMany({
    data: [
      {
        jobId: jobs[1].id,
        type: LineItemType.LABOR,
        name: "Diagnose AC system",
        qty: 1,
        unitPrice: 8900,
        laborHours: 1.2,
        taxable: false,
        status: LineItemStatus.PROPOSED,
        sortOrder: 1
      },
      {
        jobId: jobs[2].id,
        type: LineItemType.PART,
        name: "Synthetic oil",
        qty: 1,
        unitPrice: 4800,
        taxable: true,
        status: LineItemStatus.PROPOSED,
        sortOrder: 1
      },
      {
        jobId: jobs[2].id,
        type: LineItemType.LABOR,
        name: "Inspection + oil change",
        qty: 1,
        unitPrice: 10500,
        laborHours: 1.0,
        taxable: false,
        status: LineItemStatus.PROPOSED,
        sortOrder: 2
      }
    ]
  });

  await prisma.inspectionMedia.create({
    data: {
      jobId: jobs[2].id,
      type: MediaType.PHOTO,
      url: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef",
      caption: "Filter condition"
    }
  });

  await prisma.approvalRequest.create({
    data: {
      jobId: jobs[2].id,
      status: ApprovalStatus.SENT,
      sentAt: new Date(Date.now() - 1000 * 60 * 60),
      customerTokenHash: "seeded-token-hash"
    }
  });

  for (const job of jobs) {
    await prisma.jobEvent.create({
      data: {
        jobId: job.id,
        type: JobEventType.STATE_CHANGE,
        payload: {
          fromState: null,
          toState: job.state,
          reason: "Seeded"
        },
        actorId: advisor.id
      }
    });
  }

  await prisma.jobEvent.create({
    data: {
      jobId: jobs[2].id,
      type: JobEventType.NOTE,
      payload: {
        note: "Customer prefers call after 5pm."
      },
      actorId: advisor.id
    }
  });

  await prisma.jobEvent.create({
    data: {
      jobId: jobs[2].id,
      type: JobEventType.APPROVAL_SENT,
      payload: {
        url: "http://localhost:3000/approve/" + jobs[2].id + "?t=seed-token"
      },
      actorId: advisor.id
    }
  });

  console.log("Seeded shop", shop.name, "with users:", owner.email, advisor.email, tech.email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
