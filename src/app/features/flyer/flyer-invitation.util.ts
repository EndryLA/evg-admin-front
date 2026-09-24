/**
 * Renders the shareable "invitation" flyer: the static department template
 * (`assets/invite-template.jpg`) with a user-supplied photo clipped into the
 * central circle and the place name written below the logo.
 *
 * Everything is drawn on a canvas at the template's native 1080×1080, so the
 * on-screen preview and the exported PNG are the same pixels — the preview is
 * only scaled down with CSS.
 */

export { downloadCanvasPng } from '../../shared/util/canvas.util';

/** The template's native size, in px. The canvas always renders at this scale. */
export const INVITE_SIZE = 1080;

const TEMPLATE_SRC = 'assets/invite-template.jpg';

/**
 * The heavy grotesque the flyer's lettering is set in. `Montserrat Arabic` is
 * the department's flyer typeface (`@font-face` in `styles.scss`, Black weight
 * at 900); it's awaited before drawing. The OS grotesques are the fallback if it
 * hasn't arrived, with the app font as a last resort.
 */
const FAMILY =
  "'Montserrat Arabic', Arial, 'Helvetica Neue', Helvetica, 'Plus Jakarta Sans', sans-serif";
const WEIGHT = 900;

/** Dark ink for text on the light top of the artwork. */
const INK = '#111111';

/** The template's red accent, used for the emphasised day number. */
const ACCENT = '#e11a1a';

/**
 * The placeholder circle at the centre of the template, measured off the
 * artwork. The photo is clipped to `radius` — kept just inside the white ring so
 * the ring frame stays visible around it.
 */
const CIRCLE = {
  centerX: 534,
  centerY: 534,
  radius: 276,
} as const;

/**
 * The place line (e.g. "GARE D'ÉTAMPES"), centred just below the
 * "ÉVANGÉLISATION" logo — dark on the light top of the artwork.
 */
const PLACE = {
  centerX: 540,
  centerY: 158,
  capHeight: 34,
  maxWidth: 580,
  letterSpacing: '0.01em',
} as const;

/**
 * The date/time headline on the left, centred in a column that straddles the
 * template's red accent line (measured at y≈481, x 29–189). The date reads as
 * three upper-cased lines above the line — weekday, the day number large and in
 * the accent red, then the month — with the start time below the line. All
 * centred on `centerX`, so the block sits balanced on the light left panel.
 * `maxWidth` keeps the headline clear of the central circle.
 */
const SCHEDULE = {
  /** Centre of the left column; kept clear of the circle (its left edge ≈ x258). */
  centerX: 132,
  /** The template's baked red accent line: date above, time below. */
  lineY: 481,
  maxWidth: 236,
  /** Weekday line (top), dark. */
  weekday: { capHeight: 30 },
  /** Day number (middle), large and in the accent red — the block's anchor. */
  day: { capHeight: 64 },
  /** Month line (above the red line), dark. */
  month: { capHeight: 30 },
  /** Start time below the red line, dark. */
  time: { capHeight: 32 },
  /** Vertical gaps between the pieces, template px. */
  gaps: {
    /** Weekday baseline → day cap-top — matched to `dayMonth` for even spacing. */
    weekdayDay: 14,
    /** Day baseline → month cap-top — tight, so the day and month read as a pair. */
    dayMonth: 14,
    /** Month baseline → red line. */
    monthLine: 22,
    /** Red line → time cap-top. */
    lineTime: 16,
  },
} as const;

/** A public-transport badge placed on the flyer: the line's official pictogram,
 *  freely positioned and sized (all in template px). */
export interface FlyerBadge {
  id: string;
  /** Line label for the editor UI (not drawn on the canvas), e.g. "RER C". */
  label: string;
  /** The transit line this logo shows, so the picker can mark it as placed. */
  lineId?: string;
  /** Official line pictogram (square PNG), loaded from the IDFM proxy. */
  image: HTMLImageElement;
  /** Centre position, template px. */
  x: number;
  y: number;
  /** Box side, template px. */
  size: number;
}

/** The values written onto the template. */
export interface InviteValues {
  /** Photo dropped into the central circle; `null` leaves the placeholder. */
  photo: HTMLImageElement | null;
  /** Place shown under the logo (e.g. "GARE D'ÉTAMPES"); blank leaves it empty. */
  place: string;
  /** Stacked date lines above the accent line, e.g. ["SAMEDI", "10", "OCTOBRE"];
   *  empty hides the block. */
  dateLines: string[];
  /** Headline time below the accent line, e.g. "À 11H00"; blank hides it. */
  timeText: string;
  /** Zoom on top of the cover-fit base scale (1 = fills the disc exactly). */
  scale: number;
  /** Pan offset from centre, in template px. */
  offsetX: number;
  offsetY: number;
  /** Transport badges placed on the flyer, drawn in order (last on top). */
  badges: FlyerBadge[];
}

/** Backdrop painted inside the disc, so any area the photo doesn't cover reads
 *  as a clean fill rather than the template's placeholder pattern. */
const DISC_BACKDROP = '#ffffff';

/**
 * The photo's drawn size at a given zoom. `scale` multiplies the cover-fit base
 * size (`scale = 1` fills the disc exactly when centred); the photo can then be
 * panned anywhere — nothing is clamped, so framing is entirely free.
 */
function photoGeometry(
  photo: HTMLImageElement,
  scale: number,
): { drawW: number; drawH: number } {
  const diameter = CIRCLE.radius * 2;
  const base = Math.max(diameter / photo.width, diameter / photo.height);
  const s = base * scale;
  return { drawW: photo.width * s, drawH: photo.height * s };
}

let templateRequest: Promise<HTMLImageElement> | null = null;

/** The template bitmap, fetched once and reused across redraws. */
function loadTemplate(): Promise<HTMLImageElement> {
  templateRequest ??= new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Modèle de l'invitation introuvable."));
    image.src = TEMPLATE_SRC;
  }).catch((error: unknown) => {
    // Don't cache the failure — a retry should re-request the file.
    templateRequest = null;
    throw error;
  });
  return templateRequest;
}

/**
 * Settle the font stack before measuring. Only matters where the local
 * grotesques are missing and the render falls back to the webfont — an unloaded
 * face would otherwise be measured at the wrong metrics.
 */
async function ensureFont(): Promise<void> {
  if (!('fonts' in document)) {
    return;
  }
  try {
    // Await the flyer face by its own name as well as the full stack, so the
    // first draw doesn't fall back to Arial before the webfont arrives.
    await Promise.all([
      document.fonts.load(`${WEIGHT} 100px "Montserrat Arabic"`),
      document.fonts.load(`${WEIGHT} ${PLACE.capHeight}px ${FAMILY}`),
    ]);
  } catch {
    // A font that won't load isn't worth failing the render over.
  }
}

/**
 * The px font-size at which `sample` inks exactly `targetHeight` tall. Measured
 * rather than hardcoded, so the layout holds if the family or weight changes.
 */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  sample: string,
  targetHeight: number,
): number {
  const probe = 100;
  ctx.font = `${WEIGHT} ${probe}px ${FAMILY}`;
  const metrics = ctx.measureText(sample);
  const inked = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  return inked > 0 ? (targetHeight / inked) * probe : targetHeight;
}

/**
 * Draw `text` centred on (`centerX`, `centerY`) at `size`, shrinking it to fit
 * `maxWidth`. Centred on the glyphs' own ink box rather than the font's line
 * box, so the line sits optically centred on its baseline point.
 */
function drawCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  size: number,
  maxWidth: number,
): void {
  ctx.textAlign = 'center';
  ctx.font = `${WEIGHT} ${size}px ${FAMILY}`;
  let metrics = ctx.measureText(text);

  if (metrics.width > maxWidth) {
    ctx.font = `${WEIGHT} ${(size * maxWidth) / metrics.width}px ${FAMILY}`;
    metrics = ctx.measureText(text);
  }

  const baseline =
    centerY + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  ctx.fillText(text, centerX, baseline);
}

/**
 * Draw `text` horizontally centred on (`centerX`, `baseline`), shrinking the size
 * only so it fits `maxWidth`. Used for the centred date/time column, where each
 * line's baseline is placed precisely so the block stacks the way it's measured.
 */
function drawColumn(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  baseline: number,
  size: number,
  maxWidth: number,
): void {
  ctx.textAlign = 'center';
  ctx.font = `${WEIGHT} ${size}px ${FAMILY}`;
  const width = ctx.measureText(text).width;
  if (width > maxWidth) {
    ctx.font = `${WEIGHT} ${(size * maxWidth) / width}px ${FAMILY}`;
  }
  ctx.fillText(text, centerX, baseline);
}

/**
 * Draw `photo` into the template's circle, clipped to the disc, at `scale` zoom
 * and freely panned by (`offsetX`, `offsetY`). A neutral backdrop fills the disc
 * first, so any area the photo doesn't cover stays clean.
 */
function drawPhoto(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement,
  scale: number,
  offsetX: number,
  offsetY: number,
): void {
  const { centerX, centerY, radius } = CIRCLE;
  const { drawW, drawH } = photoGeometry(photo, scale);

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = DISC_BACKDROP;
  ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
  ctx.drawImage(photo, centerX - drawW / 2 + offsetX, centerY - drawH / 2 + offsetY, drawW, drawH);
  ctx.restore();
}

/** Draw one transport badge: the official pictogram, plus a dashed selection
 *  box in the preview (never on export). */
function drawBadge(ctx: CanvasRenderingContext2D, badge: FlyerBadge, selected: boolean): void {
  const half = badge.size / 2;
  ctx.drawImage(badge.image, badge.x - half, badge.y - half, badge.size, badge.size);

  if (selected) {
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#d81f27';
    ctx.strokeRect(badge.x - half - 6, badge.y - half - 6, badge.size + 12, badge.size + 12);
    ctx.restore();
  }
}

/**
 * Paint `values` over the template into `canvas`, resizing it to the template's
 * native scale. `selectedBadgeId` highlights one badge in the preview (pass
 * `null` for a clean render, e.g. on export). Rejects when the template can't load.
 */
export async function drawInvite(
  canvas: HTMLCanvasElement,
  values: InviteValues,
  selectedBadgeId: string | null = null,
): Promise<void> {
  const [template] = await Promise.all([loadTemplate(), ensureFont()]);

  canvas.width = INVITE_SIZE;
  canvas.height = INVITE_SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error("Rendu de l'invitation impossible sur ce navigateur.");
  }

  ctx.clearRect(0, 0, INVITE_SIZE, INVITE_SIZE);
  ctx.drawImage(template, 0, 0, INVITE_SIZE, INVITE_SIZE);

  // The template's placeholder circle is opaque, so the photo goes on last: the
  // cover-fit disc paints over the placeholder while staying inside the ring.
  if (values.photo) {
    drawPhoto(ctx, values.photo, values.scale, values.offsetX, values.offsetY);
  }

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;

  // Place name, centred below the logo.
  const place = values.place.trim().toLocaleUpperCase('fr-FR');
  if (place) {
    ctx.letterSpacing = PLACE.letterSpacing;
    drawCentered(
      ctx,
      place,
      PLACE.centerX,
      PLACE.centerY,
      fitFontSize(ctx, 'H', PLACE.capHeight),
      PLACE.maxWidth,
    );
    ctx.letterSpacing = '0px';
  }

  // Date/time headline on the left, centred in a column straddling the red accent
  // line: weekday / day / month above it, the start time below. The day number is
  // the block's anchor — large and in the accent red.
  ctx.letterSpacing = '0px';
  const dateLines = values.dateLines.filter((l) => l.trim());
  if (dateLines.length === 3) {
    const [weekday, day, month] = dateLines;
    const { centerX, lineY, maxWidth, gaps } = SCHEDULE;

    // Baselines stacked upward from the red line: month sits just above it, the
    // day number above the month, the weekday above the day.
    const monthBaseline = lineY - gaps.monthLine;
    const dayBaseline = monthBaseline - SCHEDULE.month.capHeight - gaps.dayMonth;
    const weekdayBaseline = dayBaseline - SCHEDULE.day.capHeight - gaps.weekdayDay;

    drawColumn(ctx, weekday, centerX, weekdayBaseline, fitFontSize(ctx, 'H', SCHEDULE.weekday.capHeight), maxWidth);
    drawColumn(ctx, month, centerX, monthBaseline, fitFontSize(ctx, 'H', SCHEDULE.month.capHeight), maxWidth);

    ctx.fillStyle = ACCENT;
    drawColumn(ctx, day, centerX, dayBaseline, fitFontSize(ctx, '0', SCHEDULE.day.capHeight), maxWidth);
    ctx.fillStyle = INK;
  }
  const timeText = values.timeText.trim();
  if (timeText) {
    drawColumn(
      ctx,
      timeText,
      SCHEDULE.centerX,
      SCHEDULE.lineY + SCHEDULE.gaps.lineTime + SCHEDULE.time.capHeight,
      fitFontSize(ctx, 'H', SCHEDULE.time.capHeight),
      SCHEDULE.maxWidth,
    );
  }

  // Transport badges last, so they sit above the photo and place name.
  for (const badge of values.badges) {
    drawBadge(ctx, badge, badge.id === selectedBadgeId);
  }
}
