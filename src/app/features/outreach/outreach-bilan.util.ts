/**
 * Renders the shareable "bilan" visual for one outreach: the static department
 * template (`assets/bilan-template.png`) with the commune written under the
 * title and the three figures dropped into the white chips of each bar.
 *
 * Everything is drawn on a canvas at the template's native 1080×1080, so the
 * on-screen preview and the exported PNG are the same pixels — the preview is
 * only scaled down with CSS.
 */

/** The template's native size, in px. The canvas always renders at this scale. */
export const BILAN_SIZE = 1080;

const TEMPLATE_SRC = 'assets/bilan-template.png';

/**
 * The grotesque the template's own figures are set in — matched against a
 * filled-in reference export. All of these ship with the OS, so nothing has to
 * be fetched; `Plus Jakarta Sans` (the app font) is only a last resort.
 */
const FAMILY = "Arial, 'Helvetica Neue', Helvetica, 'Plus Jakarta Sans', sans-serif";
const WEIGHT = 700;
const INK = '#000000';

/**
 * Commune line under "ÉVANGÉLISATION". `capHeight` and the centre were measured
 * off a filled-in reference export, so a rendered bilan lines up with the ones
 * produced by hand.
 */
const CITY = {
  centerX: 539,
  centerY: 142,
  capHeight: 27,
  /** Keeps long commune names clear of the red cross artwork on the right. */
  maxWidth: 430,
  letterSpacing: '0.02em',
};

/**
 * The white chip of each bar, in template order (contacts, conversions,
 * ouvriers). The bars are sheared, so each chip's centre sits further right
 * than the one above it.
 */
const SLOTS = [
  { centerX: 311.5, centerY: 393.5 },
  { centerX: 334, centerY: 553 },
  { centerX: 353.5, centerY: 713 },
] as const;

/** Ink height of the figures, and the room they have inside a ~124px chip. */
const DIGIT_HEIGHT = 38;
const DIGIT_MAX_WIDTH = 104;

/** The figures written onto the template, in template order. */
export interface BilanValues {
  /** Commune shown under the title; blank leaves the line empty. */
  city: string;
  contacts: number;
  conversions: number;
  /** "Ouvriers mobilisés" — how many people were out on the sortie. */
  workers: number;
}

let templateRequest: Promise<HTMLImageElement> | null = null;

/** The template bitmap, fetched once and reused across redraws. */
function loadTemplate(): Promise<HTMLImageElement> {
  templateRequest ??= new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Modèle du bilan introuvable.'));
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
 * grotesques are missing and the render falls back to the webfont — an
 * unloaded face would otherwise be measured at the wrong metrics.
 */
async function ensureFont(): Promise<void> {
  if (!('fonts' in document)) {
    return;
  }
  try {
    await document.fonts.load(`${WEIGHT} ${DIGIT_HEIGHT}px ${FAMILY}`);
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
 * box, so a figure sits optically centred in its chip.
 */
function drawCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  size: number,
  maxWidth: number,
): void {
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
 * Paint `values` over the template into `canvas`, resizing it to the template's
 * native scale. Rejects when the template image can't be loaded.
 */
export async function drawBilan(
  canvas: HTMLCanvasElement,
  values: BilanValues,
): Promise<void> {
  const [template] = await Promise.all([loadTemplate(), ensureFont()]);

  canvas.width = BILAN_SIZE;
  canvas.height = BILAN_SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Rendu du bilan impossible sur ce navigateur.');
  }

  ctx.clearRect(0, 0, BILAN_SIZE, BILAN_SIZE);
  ctx.drawImage(template, 0, 0, BILAN_SIZE, BILAN_SIZE);

  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const city = values.city.trim().toLocaleUpperCase('fr-FR');
  if (city) {
    // Set before measuring — spacing counts towards the fitted width.
    ctx.letterSpacing = CITY.letterSpacing;
    drawCentered(
      ctx,
      city,
      CITY.centerX,
      CITY.centerY,
      fitFontSize(ctx, 'H', CITY.capHeight),
      CITY.maxWidth,
    );
    ctx.letterSpacing = '0px';
  }

  const figures = [values.contacts, values.conversions, values.workers];
  const digitSize = fitFontSize(ctx, '0', DIGIT_HEIGHT);
  SLOTS.forEach((slot, i) => {
    drawCentered(
      ctx,
      String(figures[i]),
      slot.centerX,
      slot.centerY,
      digitSize,
      DIGIT_MAX_WIDTH,
    );
  });
}

/** Download `canvas` as a PNG named `filename`. */
export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) {
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    // Safari only honours `download` on an anchor in the document, and cancels
    // the transfer if the object URL is revoked too early.
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }, 'image/png');
}
