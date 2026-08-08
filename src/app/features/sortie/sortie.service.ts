import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of, type Observable } from 'rxjs';

interface RawOutreachName {
  name?: string;
}

/**
 * Minimal gateway for the public sortie landing page. Only needs the outreach's
 * name to show which sortie the visitor is about to fill a form for.
 */
@Injectable({ providedIn: 'root' })
export class SortieService {
  private readonly http = inject(HttpClient);

  /**
   * Name of an outreach, for the landing page's context line. Best-effort:
   * resolves to an empty string if the lookup fails so the page still renders.
   */
  outreachName(uuid: string): Observable<string> {
    return this.http.get<RawOutreachName>(`/api/outreaches/${uuid}`).pipe(
      map((o) => o.name ?? ''),
      catchError(() => of('')),
    );
  }
}
