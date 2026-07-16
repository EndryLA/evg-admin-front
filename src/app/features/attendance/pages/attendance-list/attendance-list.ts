import { Component } from '@angular/core';

import { AttendanceStats } from '../../components/attendance-stats/attendance-stats';

/**
 * Présences — the department-wide presence dashboard. A thin shell around
 * {@link AttendanceStats}; the per-attendance table and its create/edit/delete
 * flows have been removed in favour of the aggregated `/api/stats` view.
 */
@Component({
  selector: 'app-attendance-list',
  imports: [AttendanceStats],
  host: { class: 'data-list' },
  templateUrl: './attendance-list.html',
  styleUrl: './attendance-list.scss',
})
export class AttendanceList {}
