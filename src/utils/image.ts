/**
 * Réduit une photo dans le navigateur avant l'envoi (spec 001, R10) : côté le plus long
 * à 1 024 px, WebP (ou JPEG si le navigateur ne sait pas encoder le WebP), sous 300 Ko.
 * Un téléphone envoie ainsi quelques dizaines de Ko au lieu de plusieurs Mo.
 */

export const MAX_IMAGE_BYTES = 300 * 1024;
const MAX_SIDE = 1024;

export class ImageError extends Error {}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new ImageError('Lecture de la photo impossible.'));
    reader.readAsDataURL(blob);
  });
}

export async function shrinkImage(file: File): Promise<{ mime: string; data: string }> {
  if (!file.type.startsWith('image/')) throw new ImageError('Choisissez une image (JPEG, PNG ou WebP).');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError('Cette image ne peut pas être lue. Essayez une autre photo.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new ImageError('Votre navigateur ne permet pas de préparer la photo.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    let blob = await encode(canvas, 'image/webp', quality);
    // Safari ancien : pas d'encodeur WebP, il renvoie du PNG à la place.
    if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', quality);
    if (blob && blob.size <= MAX_IMAGE_BYTES) return { mime: blob.type, data: await toBase64(blob) };
  }
  throw new ImageError('La photo reste trop lourde après réduction. Essayez une autre photo.');
}

/** Spec 031 : un logo est recadré au carré (centre), 256 px de côté, 100 Ko au plus. */
export const MAX_LOGO_BYTES = 100 * 1024;
const LOGO_SIDE = 256;

export async function shrinkLogo(file: File): Promise<{ mime: string; data: string }> {
  if (!file.type.startsWith('image/')) throw new ImageError('Choisissez une image (JPEG, PNG ou WebP).');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError('Cette image ne peut pas être lue. Essayez une autre image.');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = LOGO_SIDE;
  canvas.height = LOGO_SIDE;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageError('Votre navigateur ne permet pas de préparer l’image.');
  // Fond blanc : un logo PNG transparent reste lisible une fois encodé.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, LOGO_SIDE, LOGO_SIDE);
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, LOGO_SIDE, LOGO_SIDE);
  bitmap.close();
  for (const quality of [0.9, 0.8, 0.65, 0.5]) {
    let blob = await encode(canvas, 'image/webp', quality);
    if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', quality);
    if (blob && blob.size <= MAX_LOGO_BYTES) return { mime: blob.type, data: await toBase64(blob) };
  }
  throw new ImageError('Le logo reste trop lourd après réduction. Essayez une autre image.');
}
