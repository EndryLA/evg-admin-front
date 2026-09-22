/** Canvas helpers shared across flyer generators (bilan, invitation, …). */

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
