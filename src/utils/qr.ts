/** QR en image : l'API fournit le SVG ; il est affiché via une URL data, jamais injecté comme HTML. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function download(href: string, filename: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadSvg(svg: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  download(url, `${filename}.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Rastérise le SVG dans le navigateur (1024 px, fond blanc) pour un PNG imprimable. */
export async function downloadPng(svg: string, filename: string, size = 1024): Promise<void> {
  const image = new Image();
  image.src = svgDataUrl(svg);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponible');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, size, size);
  download(canvas.toDataURL('image/png'), `${filename}.png`);
}
