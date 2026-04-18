import React from 'react';
import { PreviewCanvas } from '../preview/PreviewCanvas';
import { Timeline } from '../timeline/Timeline';
import { theme } from '../../styles/theme';

export const CenterArea: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 200, overflow: 'hidden' }}>
        <PreviewCanvas />
      </div>
      <div style={{
        height: 4,
        background: theme.colors.border.default,
        cursor: 'row-resize',
        flexShrink: 0,
      }} />
      <div style={{ height: 300, minHeight: 180, overflow: 'hidden' }}>
        <Timeline />
      </div>
    </div>
  );
};