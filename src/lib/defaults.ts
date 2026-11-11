import { nanoid } from 'nanoid';
import type { Clip, Project, ProjectSettings, Track, TrackKind, TextStyle } from '../types';

export const RESOLUTION_PRESETS: { label: string; width: number; height: number }[] = [
  { label: '1080p Landscape (16:9)', width: 1920, height: 1080 },
  { label: '720p Landscape (16:9)', width: 1280, height: 720 },
  { label: '4K Landscape (16:9)', width: 3840, height: 2160 },
  { label: 'Vertical (9:16)', width: 1080, height: 1920 },
  { label: 'Square (1:1)', width: 1080, height: 1080 },
  { label: 'Portrait (4:5)', width: 1080, height: 1350 },
];

export const FPS_PRESETS = [24, 25, 30, 50, 60];

export const defaultSettings = (): ProjectSettings => ({
  name: 'Untitled Project',
  width: 1920,
  height: 1080,
  fps: 30,
  background: '#000000',
});

export const makeTrack = (kind: TrackKind, index: number): Track => ({
  id: nanoid(8),
  kind,
  name: `${kind === 'video' ? 'Video' : kind === 'audio' ? 'Audio' : 'Text'} ${index}`,
  muted: false,
  hidden: false,
  locked: false,
});

export const emptyProject = (): Project => ({
  settings: defaultSettings(),
  assets: {},
  tracks: [makeTrack('text', 1), makeTrack('video', 2), makeTrack('video', 1), makeTrack('audio', 1)],
  clips: {},
});

export const defaultTextStyle = (): TextStyle => ({
  text: 'Your text here',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 96,
  fontWeight: 700,
  color: '#ffffff',
  background: '',
  align: 'center',
});

export const makeClip = (partial: Partial<Clip> & Pick<Clip, 'trackId' | 'start' | 'duration'>): Clip => ({
  id: nanoid(10),
  inPoint: 0,
  speed: 1,
  volume: 1,
  opacity: 1,
  fadeIn: 0,
  fadeOut: 0,
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  color: { brightness: 1, contrast: 1, saturation: 1, blur: 0 },
  ...partial,
});

export const FONT_FAMILIES = [
  'Inter, system-ui, sans-serif',
  'Georgia, serif',
  '"Courier New", monospace',
  'Impact, "Arial Black", sans-serif',
  '"Trebuchet MS", sans-serif',
  '"Brush Script MT", cursive',
];
