import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import {
  CategoryScale,
  Chart,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type Plugin,
} from 'chart.js';
import { forkJoin } from 'rxjs';

import { ThemeService } from '../../../../core/theme/theme.service';
import { messageFromError } from '../../../../core/http/http-error.util';
import { AttendanceStatsService } from '../../attendance-stats.service';
import {
  MONTH_LABELS,
  type AttendanceSummary,
  type OutreachAttendance,
  type ProfilePresence,
  type StatsPeriod,
  type StatsQuery,
  type TeamStats,
} from '../../attendance-stats.models';

// Tree-shakeable Chart.js registration — only the pieces the trend line needs.
Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

/** Above how many points value labels are hidden (they'd overlap). */
const VALUE_LABEL_LIMIT = 24;

/**
 * Draws each point's value just above it. Registered per-chart (not globally);
 * skipped once the series is too dense to label without overlap. Uses the x-axis
 * tick color so it tracks the active theme.
 */
const valueLabelsPlugin: Plugin<'line'> = {
  id: 'valueLabels',
  afterDatasetsDraw(chart) {
    const meta = chart.getDatasetMeta(0);
    const data = chart.data.datasets[0]?.data as (number | null)[] | undefined;
    if (meta.hidden || !data || data.length === 0 || data.length > VALUE_LABEL_LIMIT) {
      return;
    }
    const { ctx } = chart;
    const tick = (chart.options.scales?.['x']?.ticks?.color as string | undefined) ?? '#71717a';
    ctx.save();
    ctx.font = `600 10px ${Chart.defaults.font.family}`;
    ctx.fillStyle = tick;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    meta.data.forEach((point, i) => {
      const value = data[i];
      if (value != null) {
        ctx.fillText(String(value), point.x, point.y - 6);
      }
    });
    ctx.restore();
  },
};

/** Quick range presets offered above the dashboard. */
type Preset = StatsPeriod | 'all' | 'custom';

/** Theme-derived colors for the trend chart (light/dark). */
interface ChartColors {
  total: string;
  member: string;
  guest: string;
  grid: string;
  tick: string;
  surface: string;
  tooltipBg: string;
  tooltipText: string;
}

/** Which series the trend line plots. */
type Metric = 'total' | 'member' | 'guest';

/** Segmented options offered above the chart, in display order. */
const METRICS: readonly { key: Metric; label: string }[] = [
  { key: 'total', label: 'Total' },
  { key: 'member', label: 'Membres' },
  { key: 'guest', label: 'Invités' },
];

/** Empty query — department-wide, all-time. */
const EMPTY_QUERY: StatsQuery = {
  period: null,
  from: null,
  to: null,
  teamLeader: null,
  outreach: null,
  city: null,
};

/**
 * Département-wide presence dashboard, embedded in the Présences page. Pulls the
 * `/api/stats` aggregates (summary, per-outreach trend, top members, teams) for
 * a chosen range and renders headline tiles, a members-vs-guests line chart over
 * the outreaches, and the top-members / teams rankings.
 */
@Component({
  selector: 'app-attendance-stats',
  host: { class: 'stats-dashboard' },
  templateUrl: './attendance-stats.html',
  styleUrl: './attendance-stats.scss',
})
export class AttendanceStats implements OnInit {
  private readonly service = inject(AttendanceStatsService);
  private readonly theme = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

  /** The trend chart's canvas — only present while data is shown. */
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('trendCanvas');
  private chart?: Chart;

  protected readonly query = signal<StatsQuery>(EMPTY_QUERY);
  protected readonly preset = signal<Preset>('all');

  /** Series shown by the trend chart. */
  protected readonly metric = signal<Metric>('total');
  protected readonly metrics = METRICS;

  protected readonly summary = signal<AttendanceSummary | null>(null);
  protected readonly outreaches = signal<OutreachAttendance[]>([]);
  protected readonly topMembers = signal<ProfilePresence[]>([]);
  protected readonly teams = signal<TeamStats[]>([]);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  /** True once we know the range holds no outreaches. */
  protected readonly empty = computed(() => (this.summary()?.outreaches ?? 0) === 0);

  protected readonly avgLabel = computed(() => {
    const avg = this.summary()?.avgAttendancePerOutreach ?? 0;
    // One decimal, French comma, trimmed when whole.
    return avg.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  });

  /** Whether the outreaches span more than one calendar year (drives x labels). */
  private readonly multiYear = computed(() => {
    const years = new Set(
      this.outreaches()
        .map((o) => o.date.slice(0, 4))
        .filter(Boolean),
    );
    return years.size > 1;
  });

  /** Colors resolved from the active theme — recomputed on light/dark switch. */
  protected readonly colors = computed<ChartColors>(() => {
    const dark = this.theme.isDark();
    return {
      total: dark ? '#f4f4f5' : '#18181b',
      member: dark ? '#ef4444' : '#dc2626',
      guest: dark ? '#8b8b93' : '#71717a',
      grid: dark ? 'rgba(255,255,255,0.07)' : 'rgba(24,24,27,0.07)',
      tick: dark ? '#a1a1aa' : '#71717a',
      surface: dark ? '#17171b' : '#ffffff',
      tooltipBg: dark ? '#26262d' : '#18181b',
      tooltipText: dark ? '#f4f4f5' : '#ffffff',
    };
  });

  constructor() {
    // Build/refresh the chart whenever its canvas appears or the data/theme
    // change. Runs in a reactive effect so signal reads are tracked.
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      const outreaches = this.outreaches();
      const colors = this.colors();
      const multiYear = this.multiYear();
      const metric = this.metric();

      if (!canvas) {
        this.chart?.destroy();
        this.chart = undefined;
        return;
      }
      this.renderChart(canvas, outreaches, colors, multiYear, metric);
    });

    this.destroyRef.onDestroy(() => this.chart?.destroy());
  }

  ngOnInit(): void {
    this.load();
  }

  /** `YYYY-MM-DD` → `15 juil.` (+ year on a second line when multi-year). */
  private dateLabel(iso: string, multiYear: boolean): string | string[] {
    const [year, month, day] = iso.split('-');
    const label = `${Number(day)} ${MONTH_LABELS[Number(month)] ?? month}`;
    return multiYear ? [label, year] : label;
  }

  /** The per-outreach values plotted for the active metric. */
  private metricSeries(outreaches: OutreachAttendance[], metric: Metric): number[] {
    return outreaches.map((o) =>
      metric === 'total' ? o.attendances : metric === 'member' ? o.members : o.guests,
    );
  }

  /** The active metric's line color. */
  private metricColor(colors: ChartColors, metric: Metric): string {
    return metric === 'total' ? colors.total : metric === 'member' ? colors.member : colors.guest;
  }

  /** The active metric's dataset label. */
  private metricLabel(metric: Metric): string {
    return METRICS.find((m) => m.key === metric)?.label ?? '';
  }

  /** Create the chart once, then update its data/colors in place on changes. */
  private renderChart(
    canvas: HTMLCanvasElement,
    outreaches: OutreachAttendance[],
    colors: ChartColors,
    multiYear: boolean,
    metric: Metric,
  ): void {
    const labels = outreaches.map((o) => this.dateLabel(o.date, multiYear));
    const series = this.metricSeries(outreaches, metric);
    const titles = outreaches.map((o) => o.name);
    const color = this.metricColor(colors, metric);

    if (this.chart) {
      const set = this.chart.data.datasets[0];
      this.chart.data.labels = labels;
      set.data = series;
      set.label = this.metricLabel(metric);
      (this.chart.data as { titles?: string[] }).titles = titles;
      this.applyColors(colors, metric);
      this.chart.update();
      return;
    }

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      plugins: [valueLabelsPlugin],
      data: {
        labels,
        datasets: [
          {
            label: this.metricLabel(metric),
            data: series,
            borderColor: color,
            backgroundColor: color,
            pointBackgroundColor: color,
            pointBorderColor: colors.surface,
            pointBorderWidth: 1.5,
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 18 } },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: colors.tick,
              font: { size: 11, weight: 600 },
              maxRotation: 0,
              autoSkipPadding: 12,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: colors.grid },
            border: { display: false },
            ticks: {
              color: colors.tick,
              font: { size: 11 },
              precision: 0,
              maxTicksLimit: 5,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            padding: 10,
            cornerRadius: 8,
            displayColors: true,
            boxPadding: 4,
            callbacks: {
              // Prefer the outreach name; fall back to the date label.
              title: (items) => {
                const first = items[0];
                if (!first) {
                  return '';
                }
                const names = (first.chart.data as { titles?: string[] }).titles;
                return names?.[first.dataIndex] || String(first.label);
              },
            },
          },
        },
      },
    };
    this.chart = new Chart(canvas, config);
  }

  /** Push theme colors onto the existing chart's dataset and scales. */
  private applyColors(colors: ChartColors, metric: Metric): void {
    const chart = this.chart;
    if (!chart) {
      return;
    }
    const color = this.metricColor(colors, metric);
    const set = chart.data.datasets[0];
    set.borderColor = color;
    set.backgroundColor = color;
    Object.assign(set, {
      pointBackgroundColor: color,
      pointBorderColor: colors.surface,
    });

    const scales = chart.options.scales;
    if (scales?.['x']?.ticks) {
      scales['x'].ticks.color = colors.tick;
    }
    if (scales?.['y']?.ticks) {
      scales['y'].ticks.color = colors.tick;
    }
    if (scales?.['y']?.grid) {
      scales['y'].grid.color = colors.grid;
    }
    const tooltip = chart.options.plugins?.tooltip;
    if (tooltip) {
      tooltip.backgroundColor = colors.tooltipBg;
      tooltip.titleColor = colors.tooltipText;
      tooltip.bodyColor = colors.tooltipText;
    }
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const query = this.query();
    forkJoin({
      summary: this.service.summary(query),
      outreaches: this.service.outreaches(query),
      topMembers: this.service.profiles(query),
      teams: this.service.teams(query),
    }).subscribe({
      next: ({ summary, outreaches, topMembers, teams }) => {
        this.summary.set(summary);
        this.outreaches.set(outreaches);
        this.topMembers.set(topMembers);
        this.teams.set(teams);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des statistiques impossible.'));
        this.loading.set(false);
      },
    });
  }

  /** Switch which series the trend chart plots. */
  protected setMetric(metric: Metric): void {
    this.metric.set(metric);
  }

  // ---- Range presets ----
  /** Apply a server-side period preset (or clear to all-time). */
  protected applyPreset(preset: StatsPeriod | 'all'): void {
    this.preset.set(preset);
    this.query.set({
      ...EMPTY_QUERY,
      period: preset === 'all' ? null : preset,
    });
    this.load();
  }

  /** Update one custom bound; switches to a custom range and drops the preset. */
  protected setBound(which: 'from' | 'to', value: string): void {
    this.preset.set('custom');
    this.query.update((q) => ({ ...q, period: null, [which]: value || null }));
    this.load();
  }

  /** Format a 0..1 rate as a whole French percentage (e.g. `72 %`). */
  protected ratePercent(rate: number): string {
    return `${Math.round(rate * 100)} %`;
  }
}
