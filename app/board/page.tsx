import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createJob } from "@/app/actions";
import { requireSession } from "@/lib/session";
import { canManageJobs, stateLabels } from "@/lib/permissions";
import { formatVehicle, lastName } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JobPriority, JobState } from "@prisma/client";

const boardStates: JobState[] = [
  JobState.CHECKED_IN,
  JobState.DIAGNOSIS,
  JobState.WAITING_APPROVAL,
  JobState.APPROVED_READY,
  JobState.IN_REPAIR,
  JobState.WAITING_PARTS,
  JobState.QUALITY_CHECK,
  JobState.READY_PICKUP
];

export default async function BoardPage() {
  const user = await requireSession();

  if (user.role === "TECH") {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Tech view only</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Switch to the tech dashboard for your assigned jobs.</p>
            <Button asChild className="mt-4">
              <Link href="/tech">Go to Tech View</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const jobs = await prisma.job.findMany({
    where: {
      shopId: user.shopId,
      state: { not: JobState.CLOSED }
    },
    include: {
      customer: true,
      vehicle: true,
      assignedTech: true,
      events: {
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const techs = await prisma.user.findMany({
    where: { shopId: user.shopId, role: "TECH", active: true },
    orderBy: { name: "asc" }
  });

  const columns = boardStates.map((state) => ({
    state,
    label: stateLabels[state],
    jobs: jobs.filter((job) => job.state === state)
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Service Board</h1>
          <p className="text-sm text-muted-foreground">Track every job across its workflow stage.</p>
        </div>
      </div>

      {canManageJobs(user.role) && (
        <Card>
          <CardHeader>
            <CardTitle>New Job</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createJob} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Job title</Label>
                <Input id="title" name="title" placeholder="Brake noise diagnosis" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer name</Label>
                <Input id="customerName" name="customerName" placeholder="Jordan Lee" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleYear">Vehicle year</Label>
                <Input id="vehicleYear" name="vehicleYear" placeholder="2018" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleMake">Make</Label>
                <Input id="vehicleMake" name="vehicleMake" placeholder="Toyota" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleModel">Model</Label>
                <Input id="vehicleModel" name="vehicleModel" placeholder="Camry" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleTrim">Trim</Label>
                <Input id="vehicleTrim" name="vehicleTrim" placeholder="SE" />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select name="priority" defaultValue={JobPriority.NORMAL}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={JobPriority.LOW}>Low</SelectItem>
                    <SelectItem value={JobPriority.NORMAL}>Normal</SelectItem>
                    <SelectItem value={JobPriority.HIGH}>High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assign technician</Label>
                <Select name="assignedTechId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose tech" />
                  </SelectTrigger>
                  <SelectContent>
                    {techs.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Create Job</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {columns.map((column) => (
          <div key={column.state} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {column.label}
              </h2>
              <span className="text-xs text-muted-foreground">{column.jobs.length}</span>
            </div>
            <div className="space-y-3">
              {column.jobs.map((job) => {
                const event = job.events.find((item) => (item.payload as { toState?: string }).toState === job.state);
                const since = event?.createdAt ?? job.createdAt;
                const hours = Math.floor((Date.now() - new Date(since).getTime()) / 3600000);
                return (
                  <Card key={job.id}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-center justify-between">
                        <Link href={`/jobs/${job.id}`} className="text-sm font-semibold">
                          #{job.jobNumber} {lastName(job.customer.name)}
                        </Link>
                        {job.state === JobState.WAITING_APPROVAL && <Badge>Customer</Badge>}
                        {job.state === JobState.WAITING_PARTS && <Badge variant="outline">Parts</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{formatVehicle(job.vehicle)}</div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{job.assignedTech?.name ?? "Unassigned"}</span>
                        <span>{hours}h in state</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {column.jobs.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">No jobs</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
