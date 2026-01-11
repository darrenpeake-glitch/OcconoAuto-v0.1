import Link from "next/link";
import { JobState } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { formatVehicle } from "@/lib/format";
import { stateLabels, techStatesBlocked, techStatesDoNow } from "@/lib/permissions";
import { transitionJob } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TechPage() {
  const user = await requireRole(["TECH"]);

  const jobs = await prisma.job.findMany({
    where: {
      shopId: user.shopId,
      assignedTechId: user.id,
      state: { not: JobState.CLOSED }
    },
    include: { customer: true, vehicle: true },
    orderBy: { updatedAt: "desc" }
  });

  const doNow = jobs.filter((job) => techStatesDoNow.includes(job.state));
  const blocked = jobs.filter((job) => techStatesBlocked.includes(job.state));

  const renderJob = (job: typeof jobs[number]) => (
    <Card key={job.id}>
      <CardContent className="space-y-3 p-4">
        <div>
          <Link href={`/jobs/${job.id}`} className="text-sm font-semibold">
            #{job.jobNumber} {job.title}
          </Link>
          <p className="text-xs text-muted-foreground">{formatVehicle(job.vehicle)}</p>
          <p className="text-xs text-muted-foreground">{stateLabels[job.state]}</p>
        </div>
        {job.state === JobState.APPROVED_READY && (
          <form action={transitionJob}>
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="toState" value={JobState.IN_REPAIR} />
            <Button type="submit" size="sm">
              Start Repair
            </Button>
          </form>
        )}
        {job.state === JobState.IN_REPAIR && (
          <div className="flex flex-wrap gap-2">
            <form action={transitionJob}>
              <input type="hidden" name="jobId" value={job.id} />
              <input type="hidden" name="toState" value={JobState.QUALITY_CHECK} />
              <Button type="submit" size="sm">
                Send to QC
              </Button>
            </form>
            <form action={transitionJob}>
              <input type="hidden" name="jobId" value={job.id} />
              <input type="hidden" name="toState" value={JobState.WAITING_PARTS} />
              <Button type="submit" variant="outline" size="sm">
                Waiting on Parts
              </Button>
            </form>
          </div>
        )}
        {job.state === JobState.WAITING_PARTS && (
          <form action={transitionJob}>
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="toState" value={JobState.IN_REPAIR} />
            <Button type="submit" size="sm">
              Parts Arrived
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tech Dashboard</h1>
        <p className="text-sm text-muted-foreground">Focus on the work that needs your attention.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-3">
          <CardHeader className="p-0">
            <CardTitle>Do Now</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {doNow.map(renderJob)}
            {doNow.length === 0 && <p className="text-sm text-muted-foreground">Nothing urgent right now.</p>}
          </div>
        </section>
        <section className="space-y-3">
          <CardHeader className="p-0">
            <CardTitle>Blocked</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {blocked.map(renderJob)}
            {blocked.length === 0 && <p className="text-sm text-muted-foreground">No blocked jobs.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
