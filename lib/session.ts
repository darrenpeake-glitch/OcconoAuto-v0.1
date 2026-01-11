import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireSession(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/signin");
  }
  return session.user as SessionUser;
}

export async function requireRole(roles: SessionUser["role"][]) {
  const user = await requireSession();
  if (!roles.includes(user.role)) {
    redirect("/board");
  }
  return user;
}

export async function requireJobAccess(jobId: string) {
  const user = await requireSession();
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      vehicle: true,
      customer: true,
      assignedTech: true,
      lineItems: true,
      media: true,
      approvalRequest: true,
      events: {
        orderBy: { createdAt: "desc" }
      }
    }
  });
  if (!job || job.shopId !== user.shopId) {
    redirect("/board");
  }
  if (user.role === "TECH" && job.assignedTechId !== user.id) {
    redirect("/tech");
  }
  return { user, job };
}
