import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {content} from '../content';
import {GoldLine} from '../components/GoldLine';
import {Scene, SceneProps} from '../components/Scene';
import {WordReveal} from '../components/WordReveal';
import {springs} from '../theme';

const LINE2_AT = 62; // ~۱ ثانیه مکث بعد از کامل شدن خط ۱

export const Hook: React.FC<SceneProps> = ({layout}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const L = layout === 'landscape';
  const zoom = spring({frame: frame - LINE2_AT, fps, config: springs.pop});
  return (
    <Scene seed="hook">
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: L ? 40 : 56}}>
        <GoldLine start={0} duration={24} width={L ? 900 : 760} />
        <WordReveal text={content.hook.line1} layout={layout} start={14} size={L ? 104 : 84} weight={900} align="center" />
        <div style={{transform: `scale(${0.9 + 0.1 * Math.min(zoom, 1.04)})`}}>
          <WordReveal
            text={content.hook.line2}
            layout={layout}
            start={LINE2_AT}
            size={L ? 128 : 100}
            weight={900}
            align="center"
            glow
          />
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
