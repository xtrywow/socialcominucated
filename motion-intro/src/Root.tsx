import React from 'react';
import {Composition} from 'remotion';
import {Intro} from './Intro';
import {loadFonts} from './fonts';
import {FPS} from './theme';

loadFonts();

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Intro-16x9" component={Intro} durationInFrames={2700} fps={FPS} width={1920} height={1080} defaultProps={{layout: 'landscape' as const}} />
    <Composition id="Intro-9x16" component={Intro} durationInFrames={2700} fps={FPS} width={1080} height={1920} defaultProps={{layout: 'portrait' as const}} />
  </>
);
