/**
 * Domain models for the dashboard.
 *
 * The dashboard reads across several backend collections (outreaches, agenda,
 * contacts, profiles) but stays a self-contained vertical slice: it re-declares
 * the small subsets it displays rather than importing from the other features.
 */

/** Lifecycle status of a sortie. Read-only — computed by the backend. */
export type OutreachStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';

/** French labels for {@link OutreachStatus}. */
export const STATUS_LABELS: Record<OutreachStatus, string> = {
  SCHEDULED: 'Planifiée',
  IN_PROGRESS: 'En cours',
  FINISHED: 'Terminée',
  CANCELLED: 'Annulée',
};

/** Badge tone (see global `.pill--*`) per status. */
export const STATUS_TONES: Record<OutreachStatus, string> = {
  SCHEDULED: 'blue',
  IN_PROGRESS: 'amber',
  FINISHED: 'green',
  CANCELLED: 'grey',
};

/** A sortie, reduced to what the dashboard shows. */
export interface DashboardOutreach {
  uuid: string;
  name: string;
  location: string;
  /** Commune's official name, else the free-text label, else empty. */
  cityName: string;
  /** Calendar day, `YYYY-MM-DD`. */
  date: string | null;
  /** Wall-clock time, `HH:mm:ss` — carries no date, see {@link date}. */
  startTime: string | null;
  /** Wall-clock time, `HH:mm:ss` — carries no date, see {@link date}. */
  endTime: string | null;
  status: OutreachStatus;
  /** Responsible member's name, or '' when none is set. */
  managerName: string;
}

/** One sortie — or calendar event open to sign-ups — of the month with its pre-registration counts. */
export interface MonthPreAttendance {
  kind: 'OUTREACH' | 'EVENT';
  uuid: string;
  name: string;
  /** `Agapé`, `Réunion`… for an event; empty for a sortie. */
  typeLabel: string;
  /** Calendar day, `YYYY-MM-DD`. */
  date: string | null;
  startTime: string | null;
  /** An event's own status, read in outreach terms (planned → `SCHEDULED`). */
  status: OutreachStatus;
  /** Everyone pre-registered, members and guests together. */
  total: number;
  members: number;
  guests: number;
  /** Of which already confirmed as present. */
  confirmed: number;
}

/** Everything one dashboard render needs, loaded in a single pass. */
export interface DashboardData {
  /** Signed-in member's first name, for the greeting. Empty when unknown. */
  firstname: string;
  /** The soonest sortie still ahead, or `null` when none is planned. */
  next: DashboardOutreach | null;
}
