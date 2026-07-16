import type { UserRole } from './auth.models';

/**
 * Who may reach each restricted area.
 *
 * The route guards and the sidebar both read these, so a rule only ever lives
 * in one place — widen an entry and the guard opens up and the nav link
 * appears together, instead of drifting into a link that bounces (or a page
 * with no way to reach it).
 */
export const ACCESS = {
  /** Managing the accounts that may sign in. */
  users: ['SUPER_ADMIN'],
  /** Assigning members to team leaders. */
  teamLeaders: ['SUPER_ADMIN'],
  /** Maintaining the city directory. */
  cities: ['ADMIN', 'SUPER_ADMIN'],
} as const satisfies Record<string, readonly UserRole[]>;
