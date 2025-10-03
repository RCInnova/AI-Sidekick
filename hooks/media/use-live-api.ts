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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import { LiveConnectConfig, LiveServerToolCall } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { useLogStore, useSettings, useUI } from '../../lib/state';
import { AudioRecorder } from '../../lib/audio-recorder';

export type SessionState = 'idle' | 'listening' | 'paused';

export type UseLiveApiResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;

  connect: () => Promise<void>;
  disconnect: () => void;
  pause: () => void;
  resume: () => void;
  sessionState: SessionState;
  
  muted: boolean;
  toggleMute: () => void;

  isSystemAudioConnected: boolean;
  startSystemAudio: () => Promise<void>;
  stopSystemAudio: () => void;

  volume: number;
};

export function useLiveApi({
  apiKey,
}: {
  apiKey: string;
}): UseLiveApiResults {
  const { model, systemAudioInputDeviceId } = useSettings();
  const { setError } = useUI();
  const client = useMemo(() => new GenAILiveClient(apiKey, model), [apiKey, model]);
  const micAudioRecorder = useMemo(() => new AudioRecorder(), []);
  const systemAudioRecorder = useMemo(() => new AudioRecorder(), []);


  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const lastLiveTokens = useRef({ input: 0, output: 0 });

  const [volume, setVolume] = useState(0);
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [muted, setMuted] = useState(false);
  const [isSystemAudioConnected, setIsSystemAudioConnected] = useState(false);
  const [config, setConfig] = useState<LiveConnectConfig>({});

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          })
          .catch(err => {
            console.error('Error adding worklet:', err);
          });
      });
    }
  }, [audioStreamerRef]);

  // Mic audio recorder -> API
  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      ]);
    };

    if (sessionState === 'listening' && !muted) {
      micAudioRecorder.on('data', onData);
      micAudioRecorder.start();
    } else {
      micAudioRecorder.stop();
      micAudioRecorder.off('data', onData);
    }
    return () => {
      micAudioRecorder.off('data', onData);
    };
  }, [sessionState, client, muted, micAudioRecorder]);

  // System audio recorder -> API
  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      ]);
    };

    if (sessionState === 'listening' && isSystemAudioConnected) {
      systemAudioRecorder.on('data', onData);
    } else {
      systemAudioRecorder.stop();
      systemAudioRecorder.off('data', onData);
    }

    return () => {
      systemAudioRecorder.off('data', onData);
    };
  }, [sessionState, client, isSystemAudioConnected, systemAudioRecorder]);


  useEffect(() => {
    const onOpen = () => {
      useLogStore.getState().resetTokens();
      lastLiveTokens.current = { input: 0, output: 0 };
      setSessionState('listening');
    };

    const onClose = () => {
      setSessionState('idle');
    };

    const stopAudioStreamer = () => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stop();
      }
    };

    const onAudio = (data: ArrayBuffer) => {
      if (
        audioStreamerRef.current &&
        useSettings.getState().isAudioOutputEnabled
      ) {
        audioStreamerRef.current.addPCM16(new Uint8Array(data));
      }
    };

    const onTokens = (inputTokens: number, outputTokens: number) => {
      const inputDelta = inputTokens - lastLiveTokens.current.input;
      const outputDelta = outputTokens - lastLiveTokens.current.output;

      if (inputDelta > 0 || outputDelta > 0) {
        useLogStore.getState().addTokens(inputDelta, outputDelta);
        lastLiveTokens.current = { input: inputTokens, output: outputTokens };
      }
    };

    // Bind event listeners
    client.on('open', onOpen);
    client.on('close', onClose);
    client.on('interrupted', stopAudioStreamer);
    client.on('audio', onAudio);
    client.on('tokens', onTokens);


    const onToolCall = (toolCall: LiveServerToolCall) => {
      const functionResponses: any[] = [];

      for (const fc of toolCall.functionCalls) {
        // Log the function call trigger
        const triggerMessage = `Triggering function call: **${
          fc.name
        }**\n\`\`\`json\n${JSON.stringify(fc.args, null, 2)}\n\`\`\``;
        useLogStore.getState().addTurn({
          role: 'system',
          text: triggerMessage,
          isFinal: true,
        });

        // Prepare the response
        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: { result: 'ok' }, // simple, hard-coded function response
        });
      }

      // Log the function call response
      if (functionResponses.length > 0) {
        const responseMessage = `Function call response:\n\`\`\`json\n${JSON.stringify(
          functionResponses,
          null,
          2,
        )}\n\`\`\``;
        useLogStore.getState().addTurn({
          role: 'system',
          text: responseMessage,
          isFinal: true,
        });
      }

      client.sendToolResponse({ functionResponses: functionResponses });
    };

    client.on('toolcall', onToolCall);

    return () => {
      // Clean up event listeners
      client.off('open', onOpen);
      client.off('close', onClose);
      client.off('interrupted', stopAudioStreamer);
      client.off('audio', onAudio);
      client.off('toolcall', onToolCall);
      client.off('tokens', onTokens);
    };
  }, [client]);

  const connect = useCallback(async () => {
    if (!config) {
      throw new Error('config has not been set');
    }
    client.disconnect();
    await client.connect(config);
  }, [client, config]);

  const stopSystemAudio = useCallback(() => {
    systemAudioRecorder.stop();
    setIsSystemAudioConnected(false);
  }, [systemAudioRecorder]);


  const disconnect = useCallback(async () => {
    micAudioRecorder.stop();
    stopSystemAudio();
    client.disconnect();
    setSessionState('idle');
  }, [client, micAudioRecorder, stopSystemAudio]);

  const pause = useCallback(() => {
    if (sessionState === 'listening') {
      setSessionState('paused');
    }
  }, [sessionState]);

  const resume = useCallback(() => {
    if (sessionState === 'paused') {
      setSessionState('listening');
    }
  }, [sessionState]);

  const toggleMute = useCallback(() => {
    setMuted(m => !m);
  }, []);

  const startSystemAudio = useCallback(async () => {
    if (isSystemAudioConnected) return;

    try {
      let stream: MediaStream;
      if (systemAudioInputDeviceId) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: systemAudioInputDeviceId } },
          video: false,
        });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: true,
        });
      }


      // Listen for when the user stops sharing via browser UI
      const [audioTrack] = stream.getAudioTracks();
      if (audioTrack) {
        audioTrack.onended = () => {
          console.log('System audio stream ended.');
          stopSystemAudio();
        };
      }

      await systemAudioRecorder.startWithStream(stream);
      setIsSystemAudioConnected(true);
    } catch (err) {
      console.error('Error starting system audio capture:', err);
      setIsSystemAudioConnected(false); // Ensure state is correct on error
      const errorMessage =
        'System audio capture is not supported or was not permitted.\n\n' +
        (systemAudioInputDeviceId
          ? 'Please ensure the selected audio device is connected and permissions are granted.\n\n'
          : 'Please ensure you are using a supported browser (like Chrome on Desktop) and that you select "Share tab audio" or "Share system audio" in the pop-up.\n\n') +
        `Error details: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMessage);
    }
  }, [isSystemAudioConnected, systemAudioRecorder, stopSystemAudio, setError, systemAudioInputDeviceId]);

  return {
    client,
    config,
    setConfig,
    connect,
    disconnect,
    pause,
    resume,
    sessionState,
    muted,
    toggleMute,
    isSystemAudioConnected,
    startSystemAudio,
    stopSystemAudio,
    volume,
  };
}