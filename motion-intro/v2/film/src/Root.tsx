import {Composition} from 'remotion';
import {Film, FilmProps} from './Film';
import {DUR, FPS} from './timeline';

export const RemotionRoot = () => (
  <>
    <Composition id="Film-9x16" component={Film} fps={FPS} width={1080} height={1920} durationInFrames={DUR} defaultProps={{layout: '9x16', debug: false} as FilmProps} />
    <Composition id="Film-16x9" component={Film} fps={FPS} width={1920} height={1080} durationInFrames={DUR} defaultProps={{layout: '16x9', debug: false} as FilmProps} />
  </>
);
