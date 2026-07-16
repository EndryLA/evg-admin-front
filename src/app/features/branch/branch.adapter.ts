import type {
  Branch,
  BranchInput,
  BranchMember,
  BranchMemberInput,
  BranchRole,
  ProfileRef,
} from './branch.models';

/** Raw Spring `Page<T>` envelope (only fields we consume). */
export interface RawPage<T> {
  content?: T[];
}

/** Raw `ProfileResponse` (subset embedded in branch/assignment responses). */
export interface RawProfile {
  uuid?: string;
  firstname?: string;
  lastname?: string;
}

/** Raw `BranchRoleResponse`. */
export interface RawBranchRole {
  uuid?: string;
  name?: string;
  description?: string;
}

/** Raw `BranchResponse`. */
export interface RawBranch {
  uuid?: string;
  name?: string;
  description?: string;
  responsible?: RawProfile | null;
}

/** Raw `ProfileBranchResponse`. */
export interface RawProfileBranch {
  uuid?: string;
  profile?: RawProfile | null;
  branch?: RawBranch | null;
  branchRole?: RawBranchRole | null;
}

function toProfileRef(raw: RawProfile | null | undefined): ProfileRef | null {
  if (!raw?.uuid) {
    return null;
  }
  return {
    uuid: raw.uuid,
    firstname: raw.firstname ?? '',
    lastname: raw.lastname ?? '',
  };
}

/** Map a raw branch to the clean domain model. */
export function toBranch(raw: RawBranch): Branch {
  return {
    uuid: raw.uuid ?? '',
    name: raw.name ?? '',
    description: raw.description ?? '',
    responsible: toProfileRef(raw.responsible),
  };
}

/** Map a raw branch role to the clean domain model. */
export function toBranchRole(raw: RawBranchRole): BranchRole {
  return {
    uuid: raw.uuid ?? '',
    name: raw.name ?? '',
    description: raw.description ?? '',
  };
}

/** Map a raw profile-branch to a {@link BranchMember}. */
export function toBranchMember(raw: RawProfileBranch): BranchMember {
  return {
    uuid: raw.uuid ?? '',
    branchUuid: raw.branch?.uuid ?? '',
    profile: toProfileRef(raw.profile),
    role: raw.branchRole ? toBranchRole(raw.branchRole) : null,
  };
}

/** Map a domain input to the raw `BranchRequest`. */
export function toRawBranchRequest(input: BranchInput): RawBranch & { responsibleUuid?: string } {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    responsibleUuid: input.responsibleUuid || undefined,
  };
}

/** Map a domain input to the raw `ProfileBranchRequest`. */
export function toRawProfileBranchRequest(
  input: BranchMemberInput,
): { profileUuid: string; branchUuid: string; branchRoleUuid?: string } {
  return {
    profileUuid: input.profileUuid,
    branchUuid: input.branchUuid,
    branchRoleUuid: input.branchRoleUuid || undefined,
  };
}
