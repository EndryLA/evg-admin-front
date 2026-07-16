/** Minimal reference to a member, embedded in branch & assignment responses. */
export interface ProfileRef {
  uuid: string;
  firstname: string;
  lastname: string;
}

/** Full name helper for a {@link ProfileRef}. */
export function refName(profile: ProfileRef | null): string {
  if (!profile) {
    return '—';
  }
  return `${profile.firstname} ${profile.lastname}`.trim() || '—';
}

/** A local branch, mapped from the backend `BranchResponse`. */
export interface Branch {
  uuid: string;
  name: string;
  description: string;
  /** Member in charge of the branch, if any. */
  responsible: ProfileRef | null;
}

/** Editable fields when creating or updating a branch (`BranchRequest`). */
export interface BranchInput {
  name: string;
  description: string;
  responsibleUuid: string | null;
}

/** An assignable branch role, mapped from `BranchRoleResponse`. */
export interface BranchRole {
  uuid: string;
  name: string;
  description: string;
}

/**
 * A member's assignment to a branch (the former "affectation"), mapped from
 * `ProfileBranchResponse`. Managed inside the branch it belongs to.
 */
export interface BranchMember {
  uuid: string;
  /** Branch this assignment belongs to — used to group by branch. */
  branchUuid: string;
  profile: ProfileRef | null;
  role: BranchRole | null;
}

/** Payload to assign a member to a branch (`ProfileBranchRequest`). */
export interface BranchMemberInput {
  profileUuid: string;
  branchUuid: string;
  branchRoleUuid: string | null;
}

/** Selectable member/role option for the form pickers. */
export interface Option {
  uuid: string;
  label: string;
}
