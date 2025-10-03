/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { FunctionCall, useSettings, useUI, useTools } from '../lib/state';
import c from 'classnames';
import { DEFAULT_LIVE_API_MODEL, AVAILABLE_VOICES } from '../lib/constants';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import { useEffect, useState } from 'react';
import ToolEditorModal from './ToolEditorModal';

const AVAILABLE_MODELS = [
  DEFAULT_LIVE_API_MODEL,
  'gemini-2.5-flash-exp-native-audio-thinking-dialog',
  'gemini-2.0-flash-live-001'
];

export default function Sidebar() {
  const { isSidebarOpen, toggleSidebar } = useUI();
  const {
    systemPrompt,
    model,
    voice,
    isAudioOutputEnabled,
    summaryDetail,
    insightsDetail,
    actionItemsDetail,
    isDiarizationEnabled,
    systemAudioInputDeviceId,
    setSystemPrompt,
    setModel,
    setVoice,
    setIsAudioOutputEnabled,
    setSummaryDetail,
    setInsightsDetail,
    setActionItemsDetail,
    setIsDiarizationEnabled,
    setSystemAudioInputDeviceId,
  } = useSettings();
  const { tools, toggleTool, addTool, removeTool, updateTool } = useTools();
  // FIX: Property 'connected' does not exist on type 'UseLiveApiResults'.
  // 'connected' status should be derived from sessionState.
  const { sessionState } = useLiveAPIContext();
  const connected = sessionState !== 'idle';

  const [editingTool, setEditingTool] = useState<FunctionCall | null>(null);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request permissions to get device labels.
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(
          device => device.kind === 'audioinput',
        );
        setAudioInputDevices(audioInputs);
        // Stop the tracks to release the microphone.
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('Error enumerating audio devices:', err);
      }
    };

    if (isSidebarOpen) {
      getDevices();
    }
  }, [isSidebarOpen]);

  const handleSaveTool = (updatedTool: FunctionCall) => {
    if (editingTool) {
      updateTool(editingTool.name, updatedTool);
    }
    setEditingTool(null);
  };

  return (
    <>
      <aside className={c('sidebar', { open: isSidebarOpen })}>
        <div className="sidebar-header">
          <h3>Settings</h3>
          <button onClick={toggleSidebar} className="close-button">
            <span className="icon">close</span>
          </button>
        </div>
        <div className="sidebar-content">
          <div className="sidebar-section">
            <fieldset disabled={connected}>
              <label>
                System Prompt
                <textarea
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  rows={10}
                  placeholder="Describe the role and personality of the AI..."
                />
              </label>
              <label>
                Model
                <select value={model} onChange={e => setModel(e.target.value)}>
                  {AVAILABLE_MODELS.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Voice
                <select value={voice} onChange={e => setVoice(e.target.value)}>
                  {AVAILABLE_VOICES.map(v => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                System Audio Source
                <select
                  value={systemAudioInputDeviceId ?? 'default-display-media'}
                  onChange={e =>
                    setSystemAudioInputDeviceId(
                      e.target.value === 'default-display-media'
                        ? null
                        : e.target.value,
                    )
                  }
                >
                  <option value="default-display-media">Screen/Tab Audio</option>
                  {audioInputDevices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Device ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <div className="toggle-switch-container">
                <label htmlFor="audio-output-toggle">Enable Audio Output</label>
                <label className="switch">
                  <input
                    id="audio-output-toggle"
                    type="checkbox"
                    checked={isAudioOutputEnabled}
                    onChange={e => setIsAudioOutputEnabled(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </fieldset>
          </div>
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Analysis Settings</h4>
            <fieldset disabled={connected}>
              <label>
                Summary Detail
                <select value={summaryDetail} onChange={e => setSummaryDetail(e.target.value as any)}>
                  <option value="Brief">Brief</option>
                  <option value="Detailed">Detailed</option>
                </select>
              </label>
              <label>
                Insights Detail
                <select value={insightsDetail} onChange={e => setInsightsDetail(e.target.value as any)}>
                  <option value="Brief">Brief</option>
                  <option value="Detailed">Detailed</option>
                </select>
              </label>
              <label>
                Action Items Detail
                <select value={actionItemsDetail} onChange={e => setActionItemsDetail(e.target.value as any)}>
                  <option value="Brief">Brief</option>
                  <option value="Detailed">Detailed</option>
                </select>
              </label>
               <div className="toggle-switch-container">
                <label htmlFor="diarization-toggle">Speaker Diarization</label>
                <label className="switch">
                  <input
                    id="diarization-toggle"
                    type="checkbox"
                    checked={isDiarizationEnabled}
                    onChange={e => setIsDiarizationEnabled(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </fieldset>
          </div>
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">
              Integrations (Function Calling)
            </h4>
            <div className="tools-list">
              {tools.map(tool => (
                <div key={tool.name} className="tool-item">
                  <label className="tool-checkbox-wrapper">
                    <input
                      type="checkbox"
                      id={`tool-checkbox-${tool.name}`}
                      checked={tool.isEnabled}
                      onChange={() => toggleTool(tool.name)}
                      disabled={connected}
                    />
                    <span className="checkbox-visual"></span>
                  </label>
                  <label
                    htmlFor={`tool-checkbox-${tool.name}`}
                    className="tool-name-text"
                  >
                    {tool.name}
                  </label>
                  <div className="tool-actions">
                    <button
                      onClick={() => setEditingTool(tool)}
                      disabled={connected}
                      aria-label={`Edit ${tool.name}`}
                    >
                      <span className="icon">edit</span>
                    </button>
                    <button
                      onClick={() => removeTool(tool.name)}
                      disabled={connected}
                      aria-label={`Delete ${tool.name}`}
                    >
                      <span className="icon">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addTool}
              className="add-tool-button"
              disabled={connected}
            >
              <span className="icon">add</span> Add function call
            </button>
          </div>
        </div>
      </aside>
      {editingTool && (
        <ToolEditorModal
          tool={editingTool}
          onClose={() => setEditingTool(null)}
          onSave={handleSaveTool}
        />
      )}
    </>
  );
}