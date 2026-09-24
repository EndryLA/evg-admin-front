import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';

import { messageFromError } from '../../../../core/http/http-error.util';
import { BrandLogo } from '../../../../shared/ui/brand-logo/brand-logo';
import {
  MemberAutocomplete,
  type MemberValue,
} from '../../../../shared/ui/member-autocomplete/member-autocomplete';
import { formatLongDateFr, formatTimeFr, monthYearLabel } from '../../../../shared/util/date.util';
import { toNameCase } from '../../../../shared/util/text.util';
import {
  PRE_ATTENDANCE_REASON_OPTIONS,
  type MonthSlot,
  type MonthRegistrationOutcome,
  type PreAttendanceReason,
  type PreAttendanceType,
  type PreRegistrationInput,
} from '../../pre-attendance.models';
import { PreAttendanceService } from '../../pre-attendance.service';

const EMPTY_MEMBER: MemberValue = { uuid: null, label: '' };

const MONTHS_SHORT = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The member must be an actual pick from the list — free text is rejected. */
function memberPicked(control: AbstractControl): ValidationErrors | null {
  const value = control.value as MemberValue | null;
  return value && value.uuid != null ? null : { memberRequired: true };
}

/** Badge copy per outcome on the confirmation screen. */
const OUTCOME_LABELS: Record<MonthRegistrationOutcome, string> = {
  REGISTERED: 'Inscrit(e)',
  ALREADY_REGISTERED: 'Déjà inscrit(e)',
  CLOSED: 'Inscriptions closes',
};

/** A sortie or event as the page lists it: the raw slot plus its display labels. */
interface SlotRow extends MonthSlot {
  day: string;
  monthShort: string;
  when: string;
  where: string;
}

/** One line of the confirmation screen. */
interface DoneRow {
  uuid: string;
  name: string;
  when: string;
  outcome: MonthRegistrationOutcome;
  outcomeLabel: string;
}

/**
 * Public, unauthenticated monthly sign-up page (`/inscription/mois/:month`,
 * `month` as `YYYY-MM`). Lists the month's sorties — and the calendar events
 * open to sign-ups — still ahead; the visitor ticks the ones they will come to,
 * then identifies once — a member picks themselves, a guest gives their name and
 * how they heard about it. Each ticked date becomes its own pre-registration,
 * confirmed by staff on the day.
 */
@Component({
  selector: 'app-public-month-registration',
  imports: [ReactiveFormsModule, BrandLogo, MemberAutocomplete],
  templateUrl: './public-month-registration.html',
  styleUrls: [
    '../public-pre-registration/public-pre-registration.scss',
    './public-month-registration.scss',
  ],
})
export class PublicMonthRegistration implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PreAttendanceService);

  /** `YYYY-MM` from the route, bound via `withComponentInputBinding`. */
  readonly month = input.required<string>();

  protected readonly reasonOptions = PRE_ATTENDANCE_REASON_OPTIONS;

  protected readonly slots = signal<SlotRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  /** Uuids of the ticked sorties. */
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  /** Set once "Continuer" was pressed with nothing ticked. */
  protected readonly selectionError = signal(false);

  /** `pick`: choose the sorties; `who`: member or guest, then their details. */
  protected readonly step = signal<'pick' | 'who'>('pick');

  /** Member or guest — null until the visitor picks one. */
  protected readonly kind = signal<PreAttendanceType | null>(null);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  /** First name of whoever was just signed up — set once the sign-up succeeds. */
  protected readonly doneName = signal<string | null>(null);
  protected readonly doneRows = signal<DoneRow[]>([]);

  protected readonly memberForm = this.fb.nonNullable.group({
    member: [{ ...EMPTY_MEMBER } as MemberValue, [memberPicked]],
  });

  protected readonly guestForm = this.fb.nonNullable.group({
    firstname: ['', [Validators.required]],
    lastname: ['', [Validators.required]],
    reason: ['' as PreAttendanceReason | '', [Validators.required]],
    invitedBy: [''],
  });

  /** `Octobre 2026`, or the raw key when it doesn't parse. */
  protected readonly monthLabel = computed(() => monthYearLabel(`${this.month()}-01`));

  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly allSelected = computed(
    () => this.slots().length > 0 && this.selected().size === this.slots().length,
  );

  /** Whether the month offers events besides sorties — shapes the wording. */
  protected readonly hasEvents = computed(() => this.slots().some((s) => s.kind === 'EVENT'));

  /** `3 sorties`, or `3 dates` once an event is among the ticked ones. */
  protected readonly selectionLabel = computed(() => {
    const count = this.selectedCount();
    const onlySorties = this.slots()
      .filter((s) => this.selected().has(s.uuid))
      .every((s) => s.kind === 'OUTREACH');
    const noun = onlySorties ? 'sortie' : 'date';
    return `${count} ${noun}${count > 1 ? 's' : ''}`;
  });

  protected readonly submitLabel = computed(() => {
    if (this.submitting()) {
      return 'Inscription…';
    }
    return this.selectedCount() > 1 ? `Je m’inscris à ${this.selectionLabel()}` : 'Je m’inscris';
  });

  /** Headline of the confirmation, depending on whether anything was actually added. */
  protected readonly doneTitle = computed(() => {
    const added = this.doneRows().some((r) => r.outcome === 'REGISTERED');
    const name = this.doneName();
    if (!added) {
      return 'Rien de nouveau à enregistrer';
    }
    return name ? `C'est noté, ${name} !` : 'Inscription enregistrée !';
  });

  constructor() {
    // "Invité par" is required only when the guest came through an invitation.
    this.guestForm.controls.reason.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((reason) => {
        const invitedBy = this.guestForm.controls.invitedBy;
        if (reason === 'INVITATION') {
          invitedBy.addValidators(Validators.required);
        } else {
          invitedBy.removeValidators(Validators.required);
          invitedBy.setValue('', { emitEvent: false });
        }
        invitedBy.updateValueAndValidity({ emitEvent: false });
      });
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    if (!MONTH_KEY.test(this.month())) {
      this.loadError.set('Ce lien est invalide. Vérifiez le lien reçu.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    this.service.monthSlots(this.month()).subscribe({
      next: (list) => {
        this.slots.set(list.map(toRow));
        // A single sortie needs no choosing.
        this.selected.set(new Set(list.length === 1 ? [list[0].uuid] : []));
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(
          messageFromError(err, 'Les dates du mois sont introuvables. Vérifiez le lien reçu.'),
        );
        this.loading.set(false);
      },
    });
  }

  protected isSelected(uuid: string): boolean {
    return this.selected().has(uuid);
  }

  protected toggle(uuid: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(uuid)) {
        next.add(uuid);
      }
      return next;
    });
    this.selectionError.set(false);
  }

  protected toggleAll(): void {
    this.selected.set(
      this.allSelected() ? new Set() : new Set(this.slots().map((o) => o.uuid)),
    );
    this.selectionError.set(false);
  }

  /** Step 1 → 2, once at least one sortie is ticked. */
  protected next(): void {
    if (this.selectedCount() === 0) {
      this.selectionError.set(true);
      return;
    }
    this.selectionError.set(false);
    this.error.set(null);
    this.step.set('who');
  }

  /** Back to the sortie list, keeping the selection and anything typed. */
  protected editSelection(): void {
    this.error.set(null);
    this.step.set('pick');
  }

  protected get showInvitedBy(): boolean {
    return this.guestForm.controls.reason.value === 'INVITATION';
  }

  protected choose(kind: PreAttendanceType): void {
    this.error.set(null);
    this.kind.set(kind);
  }

  /** Back to the member / guest question, keeping entered values. */
  protected back(): void {
    this.error.set(null);
    this.kind.set(null);
  }

  /** Capitalize a name once the field is left — per keystroke would jump the caret. */
  protected capitalize(field: 'firstname' | 'lastname'): void {
    const control = this.guestForm.controls[field];
    control.setValue(toNameCase(control.value.trim()), { emitEvent: false });
  }

  protected submit(): void {
    const kind = this.kind();
    if (this.submitting() || kind === null) {
      return;
    }
    if (this.selectedCount() === 0) {
      this.editSelection();
      this.selectionError.set(true);
      return;
    }
    const form = kind === 'MEMBER' ? this.memberForm : this.guestForm;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    let payload: PreRegistrationInput;
    let name: string;
    if (kind === 'MEMBER') {
      const member = this.memberForm.getRawValue().member;
      payload = { type: 'MEMBER', profileUuid: member.uuid ?? '' };
      name = member.label.split(' ')[0] ?? '';
    } else {
      const v = this.guestForm.getRawValue();
      payload = {
        type: 'GUEST',
        firstname: v.firstname,
        lastname: v.lastname,
        reason: v.reason as PreAttendanceReason,
        invitedBy: v.invitedBy,
      };
      name = v.firstname.trim();
    }

    const picked = this.slots().filter((s) => this.selected().has(s.uuid));

    this.submitting.set(true);
    this.error.set(null);
    this.service.registerForMonth(this.month(), payload, picked).subscribe({
      next: (results) => {
        // Back in chronological order, which the confirmation keeps.
        const byUuid = new Map(this.slots().map((o) => [o.uuid, o]));
        this.doneRows.set(
          results.map((r) => {
            const o = byUuid.get(r.uuid);
            return {
              uuid: r.uuid,
              name: o?.name || (r.kind === 'EVENT' ? 'Événement' : 'Sortie évangélisation'),
              when: o?.when ?? '',
              outcome: r.outcome,
              outcomeLabel: OUTCOME_LABELS[r.outcome],
            };
          }),
        );
        this.submitting.set(false);
        this.doneName.set(name);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(messageFromError(err, "L'inscription n'a pas pu être envoyée. Veuillez réessayer."));
      },
    });
  }
}

/** Attach the calendar tile and the "when" / "where" lines to a sortie. */
function toRow(o: MonthSlot): SlotRow {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(o.date ?? '');

  const parts: string[] = [];
  if (o.date) {
    const date = formatLongDateFr(o.date);
    parts.push(date.charAt(0).toUpperCase() + date.slice(1));
  }
  if (o.startTime) {
    const start = formatTimeFr(o.startTime);
    parts.push(o.endTime ? `${start} – ${formatTimeFr(o.endTime)}` : `dès ${start}`);
  }

  return {
    ...o,
    day: match ? String(Number(match[3])) : '',
    monthShort: match ? (MONTHS_SHORT[Number(match[2]) - 1] ?? '') : '',
    when: parts.join(' · ') || 'Date à confirmer',
    where: [o.location, o.cityName].filter(Boolean).join(' · '),
  };
}
