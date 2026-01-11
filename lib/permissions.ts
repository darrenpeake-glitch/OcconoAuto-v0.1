import { JobState, UserRole } from "@prisma/client";

export const forwardTransitions: Record<JobState, JobState[]> = {
  CHECKED_IN: [JobState.DIAGNOSIS],
  DIAGNOSIS: [JobState.WAITING_APPROVAL],
  WAITING_APPROVAL: [JobState.APPROVED_READY],
  APPROVED_READY: [JobState.IN_REPAIR],
  IN_REPAIR: [JobState.WAITING_PARTS, JobState.QUALITY_CHECK],
  WAITING_PARTS: [JobState.IN_REPAIR],
  QUALITY_CHECK: [JobState.READY_PICKUP],
  READY_PICKUP: [JobState.CLOSED],
  CLOSED: []
};

export const backTransitions: Record<JobState, JobState[]> = {
  CHECKED_IN: [],
  DIAGNOSIS: [],
  WAITING_APPROVAL: [JobState.DIAGNOSIS],
  APPROVED_READY: [],
  IN_REPAIR: [JobState.DIAGNOSIS],
  WAITING_PARTS: [],
  QUALITY_CHECK: [JobState.IN_REPAIR],
  READY_PICKUP: [],
  CLOSED: []
};

export const techStatesDoNow = [JobState.APPROVED_READY, JobState.IN_REPAIR] as const;
export const techStatesBlocked = [JobState.WAITING_PARTS, JobState.WAITING_APPROVAL] as const;

export const stateLabels: Record<JobState, string> = {
  CHECKED_IN: "Checked In",
  DIAGNOSIS: "Diagnosis",
  WAITING_APPROVAL: "Waiting Approval",
  APPROVED_READY: "Approved / Ready",
  IN_REPAIR: "In Repair",
  WAITING_PARTS: "Waiting Parts",
  QUALITY_CHECK: "Quality Check",
  READY_PICKUP: "Ready for Pickup",
  CLOSED: "Closed"
};

export const priorityLabels = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High"
} as const;

export function canTransition(from: JobState, to: JobState) {
  return forwardTransitions[from].includes(to) || backTransitions[from].includes(to);
}

export function requiresReason(from: JobState, to: JobState) {
  return backTransitions[from].includes(to);
}

export function canManageJobs(role: UserRole) {
  return role === "OWNER" || role === "ADVISOR";
}
