"use client";

import { useState } from "react";
import { JobState } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatState } from "@/lib/format";

type TransitionControlsProps = {
  jobId: string;
  currentState: JobState;
  forwardTo?: JobState[];
  backTransitions: JobState[];
  onTransition: (formData: FormData) => void;
};

export function TransitionControls({ jobId, currentState, forwardTo, backTransitions, onTransition }: TransitionControlsProps) {
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      {forwardTo?.map((state) => (
        <form key={state} action={onTransition}>
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="toState" value={state} />
          <Button type="submit">Move to {formatState(state)}</Button>
        </form>
      ))}
      {backTransitions.map((state) => (
        <Dialog key={state}>
          <DialogTrigger asChild>
            <Button variant="outline">Back to {formatState(state)}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reason required</DialogTitle>
            </DialogHeader>
            <form action={onTransition} className="space-y-4">
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="toState" value={state} />
              <div className="space-y-2">
                <Label htmlFor={`reason-${state}`}>Reason</Label>
                <Input
                  id={`reason-${state}`}
                  name="reason"
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
              <Button type="submit">Confirm move</Button>
            </form>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
