import React, { useState, useEffect } from 'react';
import {
  saveProjectToFile, saveProjectToLocalStorage,
  loadProjectFromFile, loadProjectFromLocalStorage,
  deserializeProject, getProjectList
} from '../../utils/ProjectManager';
import { theme } from '../../styles/theme';

export const ProjectPanel: React.FC = () => {
  const [projectName, setProjectName] = useState('My Project');
  const [savedList, setSavedList] = useState<{ key: string; name: string; savedAt: string }[]>([]);
  const [message, setMessage] = useState('');

  const refreshList = () => setSavedList(getProjectList());
  useEffect(() => { refreshList(); }, []);

  const showMsg = (m: string) => { setMessage(m); setTimeout(() => setMessage(''), 3000); };

  const handleSave = () => {
    saveProjectToLocalStorage(projectName);
    showMsg(`"${projectName}" \uC800\uC7A5 \uC644\uB8CC`);
    refreshList();
  };

  const handleSaveAs = () => {
    const name = prompt('\uD504\uB85C\uC81D\uD2B8 \uC774\uB984:', projectName + ' copy');
    if (!name) return;
    setProjectName(name);
    saveProjectToLocalStorage(name);
    showMsg(`"${name}" \uC800\uC7A5 \uC644\uB8CC`);
    refreshList();
  };

  const handleExportFile = () => {
    saveProjectToFile(projectName);
    showMsg('\uD30C\uC77C \uB2E4\uC6B4\uB85C\uB4DC \uC2DC\uC791');
  };

  const handleLoadFile = async () => {
    const data = await loadProjectFromFile();
    if (data) {
      deserializeProject(data);
      setProjectName(data.name || 'Loaded Project');
      showMsg(`"${data.name}" \uBD88\uB7EC\uC624\uAE30 \uC644\uB8CC`);
    }
  };

  const handleLoadLocal = (key: string, name: string) => {
    const data = loadProjectFromLocalStorage(key);
    if (data) {
      deserializeProject(data);
      setProjectName(data.name);
      showMsg(`"${name}" \uBD88\uB7EC\uC624\uAE30 \uC644\uB8CC`);
    }
  };

  const handleDelete = (key: string) => {
    localStorage.removeItem(key);
    refreshList();
  };

  const btn: React.CSSProperties = {
    padding: '8px 12px', borderRadius: theme.radius.sm, border: 'none',
    cursor: 'pointer', fontSize: theme.fontSize.sm, fontWeight: 600, width: '100%',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Project name */}
      <input value={projectName} onChange={(e) => setProjectName(e.target.value)}
        style={{
          padding: '8px', borderRadius: theme.radius.sm,
          border: `1px solid ${theme.colors.border.default}`,
          background: theme.colors.bg.elevated, color: theme.colors.text.primary,
          fontSize: theme.fontSize.md, outline: 'none',
        }} />

      {/* Actions */}
      <button onClick={handleSave} style={{ ...btn, background: theme.colors.accent.blue, color: '#fff' }}>
        {'\uD83D\uDCBE \uC800\uC7A5'}
      </button>
      <button onClick={handleSaveAs} style={{ ...btn, background: theme.colors.accent.purple, color: '#fff' }}>
        {'\uD83D\uDCCB \uB2E4\uB978\uC774\uB984\uC73C\uB85C \uC800\uC7A5'}
      </button>
      <button onClick={handleExportFile} style={{ ...btn, background: theme.colors.accent.green, color: '#fff' }}>
        {'\uD83D\uDCC1 \uD30C\uC77C\uB85C \uB0B4\uBCF4\uB0B4\uAE30 (.flowcut)'}
      </button>
      <button onClick={handleLoadFile} style={{ ...btn, background: theme.colors.accent.amber, color: '#000' }}>
        {'\uD83D\uDCC2 \uD30C\uC77C\uC5D0\uC11C \uBD88\uB7EC\uC624\uAE30'}
      </button>

      {message && (
        <div style={{ padding: '6px 10px', borderRadius: theme.radius.sm, background: theme.colors.accent.green + '22',
          color: theme.colors.accent.green, fontSize: theme.fontSize.sm, textAlign: 'center' }}>
          {message}
        </div>
      )}

      {/* Saved projects */}
      <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.text.secondary, fontWeight: 600, marginTop: 8 }}>
        {'\uC800\uC7A5\uB41C \uD504\uB85C\uC81D\uD2B8'}
      </div>
      {savedList.length === 0 && (
        <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.text.muted, textAlign: 'center', paddingTop: 10 }}>
          {'\uC800\uC7A5\uB41C \uD504\uB85C\uC81D\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'}
        </div>
      )}
      {savedList.map(p => (
        <div key={p.key} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
          borderRadius: theme.radius.sm, background: theme.colors.bg.elevated,
          border: `1px solid ${theme.colors.border.subtle}`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.text.primary,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
            <div style={{ fontSize: 9, color: theme.colors.text.muted }}>
              {new Date(p.savedAt).toLocaleString()}
            </div>
          </div>
          <button onClick={() => handleLoadLocal(p.key, p.name)}
            style={{ background: theme.colors.accent.blue, color: '#fff', border: 'none',
              borderRadius: theme.radius.sm, padding: '3px 8px', cursor: 'pointer', fontSize: 10 }}>
            {'\uBD88\uB7EC\uC624\uAE30'}
          </button>
          <button onClick={() => handleDelete(p.key)}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: theme.colors.text.muted, fontSize: 12, padding: 2 }}>&times;</button>
        </div>
      ))}
    </div>
  );
};