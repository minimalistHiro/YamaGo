/**
 * Simple sound loader/player for YamaGo.
 *
 * Place audio files under `public/sounds/` and reference them by key here.
 * Example usage:
 *   import { playSound, preloadSounds, SoundName } from '@/lib/sounds';
 *   preloadSounds();
 *   playSound('start');
 */

export type SoundName = 'start' | 'hit' | 'notify' | 'kodou_sound';

// Map sound keys to public URLs
const soundPathByName: Record<SoundName, string> = {
  start: '/sounds/start.mp3',
  hit: '/sounds/hit.mp3',
  notify: '/sounds/notify.mp3',
  kodou_sound: '/sounds/kodou_sound.mp3',
};

const audioCache: Partial<Record<SoundName, HTMLAudioElement>> = {};

export function preloadSounds(names: SoundName[] = Object.keys(soundPathByName) as SoundName[]) {
  if (typeof window === 'undefined') return;
  for (const name of names) {
    const src = soundPathByName[name];
    const audio = new Audio(src);
    audio.preload = 'auto';
    audioCache[name] = audio;
  }
}

export async function playSound(name: SoundName, options?: { volume?: number }) {
  if (typeof window === 'undefined') return;
  const volume = options?.volume ?? 1.0;
  const base = audioCache[name] ?? new Audio(soundPathByName[name]);
  // Clone to allow overlapping playback
  const audio = base.cloneNode(true) as HTMLAudioElement;
  audio.volume = volume;
  try {
    await audio.play();
  } catch (e) {
    // Autoplay policy might block; ignore errors
    // Caller can trigger again on user gesture
  }
}

