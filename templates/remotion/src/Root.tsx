import { Composition } from 'remotion';
import { Captions, type CaptionProps } from './Captions';

const sample: CaptionProps = {
  words: [
    { word: 'Stop', start: 0.1, end: 0.4 },
    { word: 'scrolling!', start: 0.4, end: 1.0 },
    { word: 'This', start: 1.3, end: 1.5 },
    { word: 'changes', start: 1.5, end: 1.9 },
    { word: 'everything', start: 1.9, end: 2.6 },
  ],
  durationInFrames: 90,
  fps: 30,
  style: 'pop',
  position: 'lower',
  font: 'Montserrat',
  textColor: '#FFFFFF',
  accentColor: '#FFD400',
  outlineColor: '#000000',
  uppercase: true,
};

export const RemotionRoot = () => (
  <Composition
    id="Captions"
    component={Captions}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={90}
    defaultProps={sample}
    calculateMetadata={({ props }) => ({ durationInFrames: props.durationInFrames, fps: props.fps })}
  />
);
