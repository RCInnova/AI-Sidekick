/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import cn from 'classnames';

import { memo, ReactNode, useEffect, useRef } from 'react';
import { useSettings, useTools, useLogStore } from '../../../lib/state';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';

export type ControlTrayProps = {
  children?: ReactNode;
};

function ControlTray({ children }: ControlTrayProps) {
  const startButtonRef = useRef<HTMLButtonElement>(null);

  const {
    sessionState,
    connect,
    disconnect,
    pause,
    resume,
    muted,
    toggleMute,
    isSystemAudioConnected,
    startSystemAudio,
    stopSystemAudio,
  } = useLiveAPIContext();
  const isListening = sessionState === 'listening';
  const isPaused = sessionState === 'paused';
  const isIdle = sessionState === 'idle';

  useEffect(() => {
    if (isIdle && startButtonRef.current) {
      startButtonRef.current.focus();
    }
  }, [isIdle]);


  const handleExportLogs = () => {
    const { systemPrompt, model } = useSettings.getState();
    const { tools } = useTools.getState();
    const { turns } = useLogStore.getState();

    const logData = {
      configuration: {
        model,
        systemPrompt,
      },
      tools,
      conversation: turns.map(turn => ({
        ...turn,
        // Convert Date object to ISO string for JSON serialization
        timestamp: turn.timestamp.toISOString(),
      })),
    };

    const jsonString = JSON.stringify(logData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `personal-meeting-assistant-logs-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const micButtonTitle = isIdle
    ? 'Start listening'
    : muted
      ? 'Unmute microphone'
      : 'Mute microphone';

  const systemAudioTitle = isSystemAudioConnected
    ? 'Stop sharing system audio'
    : 'Share system audio (e.g. Stereo Mix)';


  return (
    <section className="control-tray">
      <nav className={cn('actions-nav')}>
        {isIdle && (
           <button
             ref={startButtonRef}
             className={cn('action-button start-button')}
             onClick={connect}
             title="Start listening"
           >
             <span className="material-symbols-outlined filled">play_arrow</span>
           </button>
        )}

        {!isIdle && (
            <>
              <button
                className={cn('action-button mic-button', { muted })}
                onClick={toggleMute}
                title={micButtonTitle}
              >
                {!muted ? (
                  <span className="material-symbols-outlined filled">mic</span>
                ) : (
                  <span className="material-symbols-outlined filled">mic_off</span>
                )}
              </button>
               <button
                  className={cn('action-button system-audio-button', { active: isSystemAudioConnected })}
                  onClick={isSystemAudioConnected ? stopSystemAudio : startSystemAudio}
                  title={systemAudioTitle}
               >
                  <span className="material-symbols-outlined filled">
                    {isSystemAudioConnected ? 'stop_screen_share' : 'speaker_group'}
                  </span>
               </button>
             <button
                className={cn('action-button pause-resume-button')}
                onClick={isPaused ? resume : pause}
                title={isPaused ? 'Resume listening' : 'Pause listening'}
             >
                <span className="material-symbols-outlined filled">
                  {isPaused ? 'play_arrow' : 'pause'}
                </span>
             </button>
             <button
                className={cn('action-button stop-button')}
                onClick={disconnect}
                title="Stop listening"
             >
                <span className="material-symbols-outlined filled">stop</span>
             </button>
           </>
        )}

        <button
          className={cn('action-button')}
          onClick={handleExportLogs}
          aria-label="Export Logs"
          title="Export session logs"
          disabled={!isIdle && !useLogStore.getState().turns.length}
        >
          <span className="icon">download</span>
        </button>
        <button
          className={cn('action-button')}
          onClick={useLogStore.getState().clearTurns}
          aria-label="Reset Session"
          title="Reset session"
          disabled={!isIdle && !useLogStore.getState().turns.length}
        >
          <span className="icon">refresh</span>
        </button>
        {children}
      </nav>

       <div className={cn('connection-container', { connected: !isIdle })}>
         <span className="text-indicator">
           {isListening && 'Listening'}
           {isPaused && 'Paused'}
         </span>
       </div>
    </section>
  );
}

export default memo(ControlTray);