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
import { formatLongDateFr, formatTimeFr } from '../../../../shared/util/date.util';
import { toNameCase } from '../../../../shared/util/text.util';
import {
  PRE_ATTENDANCE_REASON_OPTIONS,
  type PreAttendanceReason,
  type PreAttendanceType,
  type PreRegistrationInput,
  type SignUpOutreach,
  type SignUpOutreachStatus,
} from '../../pre-attendance.models';
import { PreAttendanceService } from '../../pre-attendance.service';

const EMPTY_MEMBER: MemberValue = { uuid: null, label: '' };

const MONTHS_SHORT = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

/** The member must be an actual pick from the list — free text is rejected. */
function memberPicked(control: AbstractControl): ValidationErrors | null {
  const value = control.value as MemberValue | null;
  return value && value.uuid != null ? null : { memberRequired: true };
}

/** Why sign-ups are closed, per non-open status. */
const CLOSED_COPY: Record<Exclude<SignUpOutreachStatus, 'SCHEDULED'>, { title: string; text: string }> = {
  IN_PROGRESS: {
    title: 'La sortie a commencé',
    text: 'Les inscriptions sont closes. Si vous êtes sur place, marquez votre présence avec le QR code de la sortie.',
  },
  FINISHED: {
    title: 'Sortie terminée',
    text: 'Cette sortie a déjà eu lieu, les inscriptions sont closes. Merci de votre intérêt !',
  },
  CANCELLED: {
    title: 'Sortie annulée',
    text: "Cette sortie a été annulée, il n'est plus possible de s'y inscrire.",
  },
};

/**
 * Public, unauthenticated sign-up page (`/inscription/:uuid`) for an upcoming
 * outreach. Shows when and where it takes place, then lets a department member
 * pick themselves, or a guest give their name and how they heard about it.
 * Sign-ups are accepted only while the outreach is planned; staff confirm them
 * as presences on the day.
 */
@Component({
  selector: 'app-public-pre-registration',
  imports: [ReactiveFormsModule, BrandLogo, MemberAutocomplete],
  templateUrl: './public-pre-registration.html',
  styleUrl: './public-pre-registration.scss',
})
export class PublicPreRegistration implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PreAttendanceService);

  /** Outreach id from the route, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly reasonOptions = PRE_ATTENDANCE_REASON_OPTIONS;

  protected readonly outreach = signal<SignUpOutreach | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  /** Member or guest — null until the visitor picks one. */
  protected readonly kind = signal<PreAttendanceType | null>(null);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  /** First name of whoever was just signed up — set once the sign-up succeeds. */
  protected readonly doneName = signal<string | null>(null);

  protected readonly memberForm = this.fb.nonNullable.group({
    member: [{ ...EMPTY_MEMBER } as MemberValue, [memberPicked]],
  });

  protected readonly guestForm = this.fb.nonNullable.group({
    firstname: ['', [Validators.required]],
    lastname: ['', [Validators.required]],
    reason: ['' as PreAttendanceReason | '', [Validators.required]],
    invitedBy: [''],
  });

  protected readonly closed = computed(() => {
    const status = this.outreach()?.status;
    return status && status !== 'SCHEDULED' ? CLOSED_COPY[status] : null;
  });

  /** Calendar tile: day number + short month, or null without a valid date. */
  protected readonly dateTile = computed(() => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(this.outreach()?.date ?? '');
    if (!match) {
      return null;
    }
    return { day: String(Number(match[3])), month: MONTHS_SHORT[Number(match[2]) - 1] ?? '' };
  });

  /** "Samedi 18 juillet 2026 · 11:00 – 13:00" — parts dropped when unknown. */
  protected readonly whenLabel = computed(() => {
    const o = this.outreach();
    const parts: string[] = [];
    if (o?.date) {
      const date = formatLongDateFr(o.date);
      parts.push(date.charAt(0).toUpperCase() + date.slice(1));
    }
    if (o?.startTime) {
      const start = formatTimeFr(o.startTime);
      parts.push(o.endTime ? `${start} – ${formatTimeFr(o.endTime)}` : `dès ${start}`);
    }
    return parts.join(' · ') || 'Date à confirmer';
  });

  protected readonly placeLabel = computed(() => {
    const o = this.outreach();
    return o ? [o.location, o.cityName].filter(Boolean).join(' · ') : '';
  });

  /** "On vous attend le samedi 3 octobre 2026 à 14:00. …" — parts dropped when unknown. */
  protected readonly doneText = computed(() => {
    const o = this.outreach();
    let when = '';
    if (o?.date) {
      when += ` le ${formatLongDateFr(o.date)}`;
    }
    if (o?.startTime) {
      when += ` à ${formatTimeFr(o.startTime)}`;
    }
    return `On vous attend${when}. Votre présence sera confirmée sur place.`;
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
    this.loading.set(true);
    this.loadError.set(null);
    this.service.outreach(this.uuid()).subscribe({
      next: (o) => {
        this.outreach.set(o);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(
          messageFromError(err, 'Cette sortie est introuvable. Vérifiez le lien reçu.'),
        );
        this.loading.set(false);
      },
    });
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

    this.submitting.set(true);
    this.error.set(null);
    this.service.register(this.uuid(), payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.doneName.set(name);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(messageFromError(err, "L'inscription n'a pas pu être envoyée. Veuillez réessayer."));
      },
    });
  }

  /** Reset for signing up someone else. */
  protected again(): void {
    this.memberForm.reset({ member: { ...EMPTY_MEMBER } });
    this.guestForm.reset({ firstname: '', lastname: '', reason: '', invitedBy: '' });
    this.kind.set(null);
    this.error.set(null);
    this.doneName.set(null);
  }
}
