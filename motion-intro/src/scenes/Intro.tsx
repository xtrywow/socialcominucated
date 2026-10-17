import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {content} from '../content';
import {GoldLine} from '../components/GoldLine';
import {Portrait} from '../components/Portrait';
import {Scene, SceneProps} from '../components/Scene';
import {Signature} from '../components/Signature';
import {WordReveal} from '../components/WordReveal';
import {colors} from '../theme';

export const IntroScene: React.FC<SceneProps> = ({layout}) => {
  const frame = useCurrentFrame();
  const L = layout === 'landscape';
  const titleO = interpolate(frame, [62, 82], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <Scene seed="intro">
      <AbsoluteFill
        style={{
          flexDirection: L ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: L ? 110 : 80,
        }}
      >
        <Portrait size={L ? 520 : 560} start={4} initials={content.intro.initials} />
        <div style={{display: 'flex', flexDirection: 'column', alignItems: L ? 'flex-start' : 'center', gap: 26}}>
          <WordReveal text={content.intro.name} layout={layout} start={40} stagger={6} size={L ? 120 : 112} weight={900} align={L ? 'right' : 'center'} />
          <GoldLine start={52} duration={24} width={L ? 620 : 560} />
          <div style={{opacity: titleO, transform: `translateY(${(1 - titleO) * 20}px)`}}>
            <WordReveal
              text={content.intro.title}
              layout={layout}
              start={62}
              size={L ? 54 : 56}
              weight={700}
              color={colors.white}
              align={L ? 'right' : 'center'}
            />
          </div>
          <div style={{marginTop: 18}}>
            <Signature start={95} size={L ? 32 : 34} align={L ? 'right' : 'center'} />
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
