import React from 'react';
import {colors} from '../theme';

export const Card: React.FC<{style?: React.CSSProperties; children: React.ReactNode}> = ({style, children}) => (
  <div
    style={{
      background: `linear-gradient(160deg, ${colors.navy700} 0%, #0F2140 100%)`,
      border: `1.5px solid ${colors.gold500}40`,
      borderRadius: 28,
      boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      position: 'relative',
      ...style,
    }}
  >
    {children}
  </div>
);
