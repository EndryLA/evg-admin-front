import type {
  AttendanceSummary,
  OutreachAttendance,
  OutreachStatus,
  ProfilePresence,
  TeamStats,
} from './attendance-stats.models';

/** Raw `/api/stats` payloads — every field optional to survive partial responses. */
export interface RawAttendanceSummary {
  outreaches?: number;
  totalAttendances?: number;
  memberAttendances?: number;
  guestAttendances?: number;
  distinctMembers?: number;
  memberProportion?: number;
  guestProportion?: number;
  avgAttendancePerOutreach?: number;
}

export interface RawOutreachAttendance {
  outreachUuid?: string;
  name?: string;
  date?: string;
  location?: string;
  cityLabel?: string;
  status?: string;
  attendances?: number;
  members?: number;
  guests?: number;
}

export interface RawProfilePresence {
  profileUuid?: string;
  firstname?: string;
  lastname?: string;
  presences?: number;
  presenceRate?: number;
}

export interface RawTeamStats {
  teamLeaderUuid?: string;
  teamLeaderFirstname?: string;
  teamLeaderLastname?: string;
  members?: number;
  totalPresences?: number;
  avgPresencesPerMember?: number;
  presenceRate?: number;
}

const num = (value: number | undefined): number => value ?? 0;

const OUTREACH_STATUSES: readonly OutreachStatus[] = [
  'SCHEDULED',
  'IN_PROGRESS',
  'CANCELLED',
  'FINISHED',
];

const toStatus = (value: string | undefined): OutreachStatus =>
  OUTREACH_STATUSES.includes(value as OutreachStatus)
    ? (value as OutreachStatus)
    : 'SCHEDULED';

export function toAttendanceSummary(raw: RawAttendanceSummary): AttendanceSummary {
  return {
    outreaches: num(raw.outreaches),
    totalAttendances: num(raw.totalAttendances),
    memberAttendances: num(raw.memberAttendances),
    guestAttendances: num(raw.guestAttendances),
    distinctMembers: num(raw.distinctMembers),
    memberProportion: num(raw.memberProportion),
    guestProportion: num(raw.guestProportion),
    avgAttendancePerOutreach: num(raw.avgAttendancePerOutreach),
  };
}

export function toOutreachAttendance(raw: RawOutreachAttendance): OutreachAttendance {
  return {
    outreachUuid: raw.outreachUuid ?? '',
    name: raw.name ?? '',
    date: raw.date ?? '',
    location: raw.location ?? '',
    cityLabel: raw.cityLabel ?? '',
    status: toStatus(raw.status),
    attendances: num(raw.attendances),
    members: num(raw.members),
    guests: num(raw.guests),
  };
}

export function toProfilePresence(raw: RawProfilePresence): ProfilePresence {
  return {
    profileUuid: raw.profileUuid ?? '',
    firstname: raw.firstname ?? '',
    lastname: raw.lastname ?? '',
    presences: num(raw.presences),
    presenceRate: num(raw.presenceRate),
  };
}

export function toTeamStats(raw: RawTeamStats): TeamStats {
  return {
    teamLeaderUuid: raw.teamLeaderUuid ?? '',
    teamLeaderFirstname: raw.teamLeaderFirstname ?? '',
    teamLeaderLastname: raw.teamLeaderLastname ?? '',
    members: num(raw.members),
    totalPresences: num(raw.totalPresences),
    avgPresencesPerMember: num(raw.avgPresencesPerMember),
    presenceRate: num(raw.presenceRate),
  };
}
