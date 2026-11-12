export type AssetKind = 'video' | 'audio' | 'image';
export type TrackKind = 'video' | 'audio' | 'text';

export interface MediaAsset {
  id: string;
  name: string;
  kind: AssetKind;
  mimeType: string;
  /** Source duration in seconds (images use a default still duration). */
  duration: number;
  width: number;
  height: number;
  /** Small JPEG data URL used in the media bin and on timeline clips. */
  thumbnail?: string;
  /** Normalised (0..1) audio peaks for waveform drawing. */
  peaks?: number[];
  /** Path relative to a Reel project folder (e.g. raw/clip.mp4) when opened from one. */
  source?: string;
}

export interface Transform {
  /** Offset of the clip centre from the canvas centre, as a fraction of canvas size. */
  x: number;
  y: number;
  scale: number;
  /** Degrees. */
  rotation: number;
}

export interface ColorAdjust {
  brightness: number; // 1 = unchanged
  contrast: number; // 1 = unchanged
  saturation: number; // 1 = unchanged
  blur: number; // px
}

export interface TextStyle {
  text: string;
  fontFamily: string;
  fontSize: number; // px at project resolution
  fontWeight: number;
  color: string;
  background: string; // '' for none
  align: CanvasTextAlign;
}

export interface Clip {
  id: string;
  trackId: string;
  /** Media asset for video/audio/image clips; undefined for text clips. */
  assetId?: string;
  /** Position on the timeline, seconds. */
  start: number;
  /** Length on the timeline, seconds. */
  duration: number;
  /** Offset into the source media, seconds. */
  inPoint: number;
  /** Playback speed multiplier. */
  speed: number;
  volume: number; // 0..2
  opacity: number; // 0..1
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  transform: Transform;
  color: ColorAdjust;
  text?: TextStyle;
  /** Free-text note carried to/from a Reel cut list. */
  note?: string;
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
}

export interface ProjectSettings {
  name: string;
  width: number;
  height: number;
  fps: number;
  background: string;
}

export interface Project {
  settings: ProjectSettings;
  assets: Record<string, MediaAsset>;
  /** Ordered top-to-bottom in the UI. Visual tracks render bottom-up (top track is on top). */
  tracks: Track[];
  clips: Record<string, Clip>;
  /** Set when the project was opened from a Weequb Reel project folder (cutlist.json). */
  reel?: ReelLink;
}

export interface ReelLink {
  /** Folder name, e.g. 2026-11-12_demo-promo. */
  name: string;
  /** The cutlist.json as loaded; fields the editor doesn't model are written back unchanged. */
  cutlist: Record<string, unknown>;
}
