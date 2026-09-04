import { Component } from '@angular/core';

import { AttendanceOutreachOverview } from '../../components/attendance-outreach-overview/attendance-outreach-overview';

/**
 * Présences par sortie, at `/presences` — each outreach's attendance grouped
 * by month, broken down by team. A thin shell around
 * {@link AttendanceOutreachOverview}; the department-wide dashboard lives at
 * its own route (`/statistiques/presences`), reached via the "Statistiques"
 * sidebar group.
 */
@Component({
  selector: 'app-attendance-outreach-list',
  imports: [AttendanceOutreachOverview],
  host: { class: 'data-list' },
  templateUrl: './attendance-outreach-list.html',
  styleUrl: './attendance-outreach-list.scss',
})
export class AttendanceOutreachList {}
