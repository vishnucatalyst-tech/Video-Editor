import { beforeEach, describe, expect, it } from 'vitest';
import { useEditor } from './editor';
import type { MediaAsset } from '../types';

const asset: MediaAsset = { id: 'vid', name: 'clip.mp4', kind: 'video', mimeType: 'video/mp4', duration: 10, width: 1920, height: 1080 };

const s = () => useEditor.getState();

beforeEach(() => {
  s().newProject();
  s().addAsset(asset);
});

describe('editor store', () => {
  it('appends media to the main video track', () => {
    const a = s().addAssetToTimeline('vid')!;
    const b = s().addAssetToTimeline('vid')!;
    const clips = s().project.clips;
    expect(clips[a].start).toBe(0);
    expect(clips[b].start).toBe(10);
    expect(clips[a].trackId).toBe(clips[b].trackId);
    expect(s().project.tracks.find((t) => t.id === clips[a].trackId)?.kind).toBe('video');
  });

  it('splits at the playhead and undoes/redoes', () => {
    const id = s().addAssetToTimeline('vid')!;
    s().select([id]);
    s().setPlayhead(4);
    s().splitAtPlayhead();
    expect(Object.keys(s().project.clips)).toHaveLength(2);
    s().undo();
    expect(Object.keys(s().project.clips)).toHaveLength(1);
    expect(s().project.clips[id].duration).toBe(10);
    s().redo();
    expect(Object.keys(s().project.clips)).toHaveLength(2);
  });

  it('ripple deletes and closes the gap', () => {
    const a = s().addAssetToTimeline('vid')!;
    const b = s().addAssetToTimeline('vid')!;
    s().select([a]);
    s().deleteSelected(true);
    expect(s().project.clips[a]).toBeUndefined();
    expect(s().project.clips[b].start).toBe(0);
  });

  it('coalesces rapid edits into one undo step', () => {
    const id = s().addAssetToTimeline('vid')!;
    const before = s().past.length;
    s().updateClip(id, { opacity: 0.9 });
    s().updateClip(id, { opacity: 0.8 });
    s().updateClip(id, { opacity: 0.7 });
    expect(s().past.length).toBe(before + 1);
    s().undo();
    expect(s().project.clips[id].opacity).toBe(1);
  });

  it('records a drag gesture as a single undo step', () => {
    const id = s().addAssetToTimeline('vid')!;
    const before = s().past.length;
    s().beginGesture();
    for (let i = 1; i <= 5; i++) {
      s().updateLive((p) => ({ ...p, clips: { ...p.clips, [id]: { ...p.clips[id], start: i } } }));
    }
    s().endGesture();
    expect(s().past.length).toBe(before + 1);
    s().undo();
    expect(s().project.clips[id].start).toBe(0);
  });

  it('removing an asset removes its clips', () => {
    s().addAssetToTimeline('vid');
    s().removeAsset('vid');
    expect(Object.keys(s().project.clips)).toHaveLength(0);
  });

  it('adds text clips on a text track', () => {
    const id = s().addTextClip(2)!;
    const c = s().project.clips[id];
    expect(c.text?.text).toBeTruthy();
    expect(s().project.tracks.find((t) => t.id === c.trackId)?.kind).toBe('text');
  });

  it('duplicates selection after the original', () => {
    const id = s().addAssetToTimeline('vid')!;
    s().select([id]);
    s().duplicateSelected();
    const [copy] = s().selection;
    expect(copy).not.toBe(id);
    expect(s().project.clips[copy].start).toBe(10);
  });
});
