import { Component } from '@angular/core';

import { AttendanceStats } from '../../components/attendance-stats/attendance-stats';

/**
 * Statistiques · Présences — the department-wide presence dashboard, at
 * `/statistiques/presences`. A thin shell around {@link AttendanceStats}; the
 * per-outreach breakdown lives at its own top-level route (`/presences`).
 */
@Component({
  selector: 'app-attendance-list',
  imports: [AttendanceStats],
  host: { class: 'data-list' },
  templateUrl: './attendance-list.html',
  styleUrl: './attendance-list.scss',
})
export class AttendanceList {}
