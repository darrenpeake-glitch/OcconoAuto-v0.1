import { JobState } from "@prisma/client";
import { stateLabels } from "@/lib/permissions";

export function formatVehicle(vehicle: {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
}) {
  const parts = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean);
  return parts.join(" ") || "Vehicle";
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

export function formatState(state: JobState) {
  return stateLabels[state];
}

export function lastName(fullName: string) {
  const parts = fullName.split(" ");
  return parts[parts.length - 1] || fullName;
}

export function formatDateTime(value?: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}
