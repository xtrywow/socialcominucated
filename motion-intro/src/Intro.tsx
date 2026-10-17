import React from 'react';
import {AbsoluteFill, Audio, interpolate, staticFile, useVideoConfig} from 'remotion';
import {linearTiming, TransitionSeries} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';
import {goldWipe} from './components/GoldWipe';
import {hasPublicFile} from './components/Portrait';
import {Layout, SCENE_FRAMES, TRANSITION} from './theme';
import {Hook} from './scenes/Hook';
import {IntroScene} from './scenes/Intro';
import {Problem} from './scenes/Problem';
import {Approach} from './scenes/Approach';
import {Services} from './scenes/Services';
import {AIScene} from './scenes/AI';
import {Cases} from './scenes/Cases';
import {Process} from './scenes/Process';
import {CTA} from './scenes/CTA';

const timing = linearTiming({durationInFrames: TRANSITION});

const scenes = [
  {C: Hook, d: SCENE_FRAMES.hook},
  {C: IntroScene, d: SCENE_FRAMES.intro},
  {C: Problem, d: SCENE_FRAMES.problem},
  {C: Approach, d: SCENE_FRAMES.approach},
  {C: Services, d: SCENE_FRAMES.services},
  {C: AIScene, d: SCENE_FRAMES.ai},
  {C: Cases, d: SCENE_FRAMES.cases},
  {C: Process, d: SCENE_FRAMES.process},
  {C: CTA, d: SCENE_FRAMES.cta},
];

// انتقال بعد از هر صحنه: wipe طلایی در لحظه‌های کلیدی (معرفی، تمایز AI، دعوت به اقدام)
const transitions = [
  goldWipe(),
  fade(),
  slide({direction: 'from-left'}),
  fade(),
  goldWipe(),
  slide({direction: 'from-left'}),
  fade(),
  goldWipe(),
];

export const Intro: React.FC<{layout: Layout}> = ({layout}) => {
  const {durationInFrames, fps} = useVideoConfig();
  const music = hasPublicFile('music.mp3');
  const voice = hasPublicFile('voice.mp3');
  return (
    <AbsoluteFill>
      <TransitionSeries>
        {scenes.map(({C, d}, i) => (
          <React.Fragment key={i}>
            {/* هر صحنه به‌جز آخری ۱۵ فریم بیشتر می‌گیرد تا هم‌پوشانی انتقال جبران شود */}
            <TransitionSeries.Sequence durationInFrames={d + (i < scenes.length - 1 ? TRANSITION : 0)}>
              <C layout={layout} />
            </TransitionSeries.Sequence>
            {i < transitions.length && <TransitionSeries.Transition presentation={transitions[i] as never} timing={timing} />}
          </React.Fragment>
        ))}
      </TransitionSeries>
      {music && (
        <Audio
          src={staticFile('music.mp3')}
          volume={(f) =>
            interpolate(f, [0, fps, durationInFrames - 2 * fps, durationInFrames], [0, voice ? 0.35 : 0.8, voice ? 0.35 : 0.8, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      )}
      {voice && <Audio src={staticFile('voice.mp3')} />}
    </AbsoluteFill>
  );
};
