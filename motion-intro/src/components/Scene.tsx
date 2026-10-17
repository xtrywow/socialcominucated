import React from 'react';
import {AbsoluteFill} from 'remotion';
import {FONT, Layout} from '../theme';
import {Background} from './Background';

export type SceneProps = {layout: Layout};

export const Scene: React.FC<{seed: string; freezeAt?: number; children: React.ReactNode}> = ({seed, freezeAt, children}) => (
  <AbsoluteFill dir="rtl" lang="fa" style={{fontFamily: FONT}}>
    <Background seed={seed} freezeAt={freezeAt} />
    {children}
  </AbsoluteFill>
);
