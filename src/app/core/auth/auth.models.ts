/** Application roles, as emitted by the backend. */
export type UserRole =
  | 'SUPER_ADMIN'
  | 'DEPARTMENT_RESPONSIBLE'
  | 'ADMIN'
  | 'TEAM_LEADER';

/** French labels for {@link UserRole}. */
export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super administrateur',
  DEPARTMENT_RESPONSIBLE: 'Responsable de département',
  ADMIN: 'Administrateur',
  TEAM_LEADER: "Chef d'équipe",
};

/** Credentials submitted on the login form. */
export interface Credentials {
  email: string;
  password: string;
}

/** Tokens returned by a successful login, mapped to the domain. */
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

/**
 * Authenticated user, derived from the claims embedded in the access token.
 * The backend exposes no `/me` endpoint, so identity is read from the JWT.
 */
export interface AuthenticatedUser {
  /** Best-effort subject/uuid claim. */
  uuid: string | null;
  email: string | null;
  role: UserRole | null;
  profileUuid: string | null;
}

/** Payload of the password-reset form (token comes from the email link). */
export interface ResetPassword {
  token: string;
  newPassword: string;
}

/** Payload confirming account activation (token comes from the email link). */
export interface ActivationConfirmation {
  token: string;
  password: string;
}
