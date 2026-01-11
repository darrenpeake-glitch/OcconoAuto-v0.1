import Link from "next/link";
import { notFound } from "next/navigation";
import { JobState, LineItemType } from "@prisma/client";
import { addLineItem, addMedia, addNote, assignTech, requestApproval, transitionJob } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { requireJobAccess } from "@/lib/session";
import { backTransitions, canManageJobs, forwardTransitions, stateLabels } from "@/lib/permissions";
import { formatCurrency, formatDateTime, formatState, formatVehicle } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TransitionControls } from "@/components/transition-controls";

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const { user, job } = await requireJobAccess(params.id);
  if (!job) return notFound();

  const techs = await prisma.user.findMany({
    where: { shopId: user.shopId, role: "TECH", active: true },
    orderBy: { name: "asc" }
  });

  const lineItems = [...job.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);
  const totals = lineItems.reduce(
    (acc, item) => {
      const total = item.unitPrice * item.qty;
      acc.subtotal += total;
      if (item.taxable) acc.taxable += total;
      return acc;
    },
    { subtotal: 0, taxable: 0 }
  );

  const approvalEvent = job.events.find((event) => event.type === "APPROVAL_SENT");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/board" className="text-xs text-muted-foreground">&larr; Back to board</Link>
          <h1 className="text-2xl font-semibold">
            Job #{job.jobNumber}: {job.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {job.customer.name} &middot; {formatVehicle(job.vehicle)}
          </p>
        </div>
        <Badge variant="outline">{formatState(job.state)}</Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="work">Work</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Job status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">State</p>
                    <p className="text-sm font-medium">{stateLabels[job.state]}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Priority</p>
                    <p className="text-sm font-medium">{job.priority}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Promised at</p>
                    <p className="text-sm font-medium">{formatDateTime(job.promisedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned tech</p>
                    <p className="text-sm font-medium">{job.assignedTech?.name ?? "Unassigned"}</p>
                  </div>
                </div>
                <TransitionControls
                  jobId={job.id}
                  currentState={job.state}
                  forwardTo={forwardTransitions[job.state]}
                  backTransitions={backTransitions[job.state]}
                  onTransition={transitionJob}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assignment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form action={assignTech} className="space-y-2">
                  <input type="hidden" name="jobId" value={job.id} />
                  <Label>Assigned tech</Label>
                  <Select name="assignedTechId" defaultValue={job.assignedTechId ?? undefined}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tech" />
                    </SelectTrigger>
                    <SelectContent>
                      {techs.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="submit" size="sm" disabled={!canManageJobs(user.role)}>
                    Update assignment
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {job.events
                  .filter((event) => event.type === "NOTE")
                  .map((event) => (
                    <div key={event.id} className="rounded-md border p-3 text-sm">
                      <p>{(event.payload as { note?: string }).note}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</p>
                    </div>
                  ))}
                {job.events.filter((event) => event.type === "NOTE").length === 0 && (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                )}
              </div>
              <form action={addNote} className="space-y-2">
                <input type="hidden" name="jobId" value={job.id} />
                <Label htmlFor="note">Add note</Label>
                <Textarea id="note" name="note" required />
                <Button type="submit" size="sm">
                  Add note
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="work">
          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.type}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell>{item.status}</TableCell>
                      <TableCell>{formatCurrency(item.unitPrice * item.qty)}</TableCell>
                    </TableRow>
                  ))}
                  {lineItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                        No line items added.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex justify-end text-sm">
                <div className="space-y-1">
                  <div className="flex justify-between gap-6">
                    <span>Subtotal</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                </div>
              </div>

              {canManageJobs(user.role) && (
                <form action={addLineItem} className="grid gap-4 md:grid-cols-3">
                  <input type="hidden" name="jobId" value={job.id} />
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select name="type" defaultValue={LineItemType.LABOR}>
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={LineItemType.LABOR}>Labor</SelectItem>
                        <SelectItem value={LineItemType.PART}>Part</SelectItem>
                        <SelectItem value={LineItemType.FEE}>Fee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Description</Label>
                    <Input name="name" placeholder="Brake pads" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Qty</Label>
                    <Input name="qty" type="number" min="1" defaultValue="1" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit price (cents)</Label>
                    <Input name="unitPrice" type="number" min="0" defaultValue="0" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Labor hours</Label>
                    <Input name="laborHours" type="number" step="0.1" min="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <input type="checkbox" name="taxable" />
                      Taxable
                    </Label>
                  </div>
                  <div className="md:col-span-3">
                    <Button type="submit" size="sm">
                      Add line item
                    </Button>
                  </div>
                </form>
              )}

              {canManageJobs(user.role) && job.state === JobState.DIAGNOSIS && (
                <div className="rounded-md border border-dashed p-4">
                  <p className="text-sm text-muted-foreground">Ready to request customer approval?</p>
                  <form action={requestApproval} className="mt-3">
                    <input type="hidden" name="jobId" value={job.id} />
                    <Button type="submit">Request Approval</Button>
                  </form>
                </div>
              )}

              {approvalEvent && (
                <div className="rounded-md border bg-muted p-3 text-sm">
                  <p className="font-medium">Latest approval link</p>
                  <p className="break-all text-xs text-muted-foreground">
                    {(approvalEvent.payload as { url?: string }).url}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media">
          <Card>
            <CardHeader>
              <CardTitle>Inspection media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {job.media.map((media) => (
                  <div key={media.id} className="rounded-md border p-3">
                    <p className="text-sm font-medium">{media.type}</p>
                    <a href={media.url} className="text-xs text-primary" target="_blank">
                      {media.url}
                    </a>
                    {media.caption && <p className="text-xs text-muted-foreground">{media.caption}</p>}
                  </div>
                ))}
                {job.media.length === 0 && <p className="text-sm text-muted-foreground">No media yet.</p>}
              </div>

              {canManageJobs(user.role) && (
                <form action={addMedia} className="grid gap-4 md:grid-cols-3">
                  <input type="hidden" name="jobId" value={job.id} />
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select name="type" defaultValue="PHOTO">
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PHOTO">Photo</SelectItem>
                        <SelectItem value="VIDEO">Video</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Media URL</Label>
                    <Input name="url" type="url" required />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label>Caption</Label>
                    <Input name="caption" />
                  </div>
                  <div className="md:col-span-3">
                    <Button type="submit" size="sm">
                      Add media
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
