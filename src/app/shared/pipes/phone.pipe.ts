import { Pipe, type PipeTransform } from '@angular/core';

import { displayPhoneFr } from '../util/text.util';

/** Render a stored phone number as `XX XX XX XX XX`, or `—` when absent. */
@Pipe({ name: 'phoneFr' })
export class PhoneFrPipe implements PipeTransform {
  transform(value?: string | null): string {
    return displayPhoneFr(value);
  }
}
