import type { MembershipType, Profile, ProfileInput } from './profile.models';

/** Raw `ProfileResponse` as returned by the backend. */
export interface RawProfile {
  uuid?: string;
  firstname?: string;
  lastname?: string;
  phoneNumber?: string | null;
  email?: string | null;
  birthDate?: string | null;
  membershipType?: string | null;
  firstDepartment?: boolean | null;
  joinedAt?: number | string | null;
  isTeamLeader?: boolean | null;
  leaderUuid?: string | null;
  leaderFirstname?: string | null;
}

/** Raw Spring `Page<ProfileResponse>` envelope (only fields we consume). */
export interface RawPage<T> {
  content?: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
}

function toMembership(value: string | null | undefined): MembershipType | null {
  return value === 'OUVRIER' || value === 'AIDE' ? value : null;
}

/** Coerce a raw joined-year (number or string) to a number, or `null`. */
function toYear(value: number | string | null | undefined): number | null {
  if (value == null || value === '') {
    return null;
  }
  const year = Number(value);
  return Number.isFinite(year) ? year : null;
}

/** Map a raw profile to the clean domain model. */
export function toProfile(raw: RawProfile): Profile {
  return {
    uuid: raw.uuid ?? '',
    firstname: raw.firstname ?? '',
    lastname: raw.lastname ?? '',
    phoneNumber: raw.phoneNumber ?? null,
    email: raw.email ?? null,
    birthDate: raw.birthDate ?? null,
    membershipType: toMembership(raw.membershipType),
    firstDepartment: raw.firstDepartment ?? false,
    joinedAt: toYear(raw.joinedAt),
    isTeamLeader: raw.isTeamLeader ?? false,
    leaderUuid: raw.leaderUuid ?? null,
    leaderFirstname: raw.leaderFirstname ?? null,
  };
}

/** Map a domain input to the raw `ProfileRequest`, omitting empty optionals. */
export function toRawProfileRequest(input: ProfileInput): RawProfile {
  return {
    firstname: input.firstname.trim(),
    lastname: input.lastname.trim(),
    phoneNumber: input.phoneNumber?.trim() || null,
    email: input.email?.trim() || null,
    birthDate: input.birthDate || null,
    membershipType: input.membershipType ?? null,
    firstDepartment: input.firstDepartment,
    joinedAt: input.joinedAt ?? null,
  };
}
