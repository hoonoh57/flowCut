import React from 'react';
import { EditorLayout } from './components/layout/EditorLayout';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePlayback } from './hooks/usePlayback';

const App: React.FC = () => {
  useKeyboardShortcuts();
  usePlayback();
  return <EditorLayout />;
};

export default App;