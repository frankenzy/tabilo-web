/** Signal sonore court (Web Audio, aucun fichier). Silencieux si le navigateur le refuse. */
let context: AudioContext | null = null;

export function chime(kind: 'new' | 'alert' = 'new'): void {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const notes = kind === 'alert' ? [880, 660, 880] : [660, 880];
    notes.forEach((frequency, index) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      const start = context!.currentTime + index * 0.14;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
      oscillator.connect(gain).connect(context!.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.14);
    });
  } catch {
    // pas de son : l'alerte visuelle reste affichée
  }
}
