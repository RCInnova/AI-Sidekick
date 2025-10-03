/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
import {
  FunctionResponse,
  FunctionResponseScheduling,
  LiveServerToolCall,
} from '@google/genai';
import { Analysis } from '../components/demo/streaming-console/AnalysisDashboard';

/**
 * Settings
 */
export type DetailLevel = 'Brief' | 'Detailed';

export const useSettings = create<{
  systemPrompt: string;
  model: string;
  voice: string;
  isAudioOutputEnabled: boolean;
  summaryDetail: DetailLevel;
  insightsDetail: DetailLevel;
  actionItemsDetail: DetailLevel;
  isDiarizationEnabled: boolean;
  systemAudioInputDeviceId: string | null;
  setSystemPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setVoice: (voice: string) => void;
  setIsAudioOutputEnabled: (enabled: boolean) => void;
  setSummaryDetail: (detail: DetailLevel) => void;
  setInsightsDetail: (detail: DetailLevel) => void;
  setActionItemsDetail: (detail: DetailLevel) => void;
  setIsDiarizationEnabled: (enabled: boolean) => void;
  setSystemAudioInputDeviceId: (deviceId: string | null) => void;
}>(set => ({
  systemPrompt: `You are a meeting assistant. Your role is to listen to the meeting transcript, provide real-time contextual updates, generate concise summaries, identify key insights and action items, and perform sentiment analysis of the conversation. Present the information in a clear, structured format.`,
  model: DEFAULT_LIVE_API_MODEL,
  voice: DEFAULT_VOICE,
  isAudioOutputEnabled: false,
  summaryDetail: 'Brief',
  insightsDetail: 'Brief',
  actionItemsDetail: 'Brief',
  isDiarizationEnabled: false,
  systemAudioInputDeviceId: null,
  setSystemPrompt: prompt => set({ systemPrompt: prompt }),
  setModel: model => set({ model }),
  setVoice: voice => set({ voice }),
  setIsAudioOutputEnabled: enabled => set({ isAudioOutputEnabled: enabled }),
  setSummaryDetail: detail => set({ summaryDetail: detail }),
  setInsightsDetail: detail => set({ insightsDetail: detail }),
  setActionItemsDetail: detail => set({ actionItemsDetail: detail }),
  setIsDiarizationEnabled: enabled => set({ isDiarizationEnabled: enabled }),
  setSystemAudioInputDeviceId: deviceId => set({ systemAudioInputDeviceId: deviceId }),
}));

/**
 * UI
 */
export const useUI = create<{
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  error: string | null;
  setError: (error: string | null) => void;
}>(set => ({
  isSidebarOpen: true,
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
  error: null,
  setError: (error: string | null) => set({ error }),
}));

/**
 * Tools
 */
export interface FunctionCall {
  name: string;
  description?: string;
  parameters?: any;
  isEnabled: boolean;
  scheduling?: FunctionResponseScheduling;
}

export const useTools = create<{
  tools: FunctionCall[];
  toggleTool: (toolName: string) => void;
  addTool: () => void;
  removeTool: (toolName: string) => void;
  updateTool: (oldName: string, updatedTool: FunctionCall) => void;
}>(set => ({
  tools: [],
  toggleTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === toolName ? { ...tool, isEnabled: !tool.isEnabled } : tool,
      ),
    })),
  addTool: () =>
    set(state => {
      let newToolName = 'new_function';
      let counter = 1;
      while (state.tools.some(tool => tool.name === newToolName)) {
        newToolName = `new_function_${counter++}`;
      }
      return {
        tools: [
          ...state.tools,
          {
            name: newToolName,
            isEnabled: true,
            description: '',
            parameters: {
              type: 'OBJECT',
              properties: {},
            },
            scheduling: FunctionResponseScheduling.INTERRUPT,
          },
        ],
      };
    }),
  removeTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.filter(tool => tool.name !== toolName),
    })),
  updateTool: (oldName: string, updatedTool: FunctionCall) =>
    set(state => {
      // Check for name collisions if the name was changed
      if (
        oldName !== updatedTool.name &&
        state.tools.some(tool => tool.name === updatedTool.name)
      ) {
        console.warn(`Tool with name "${updatedTool.name}" already exists.`);
        // Prevent the update by returning the current state
        return state;
      }
      return {
        tools: state.tools.map(tool =>
          tool.name === oldName ? updatedTool : tool,
        ),
      };
    }),
}));

/**
 * Session Data
 */
export const useSessionStore = create<{
  customerPhoneNumber: string | null;
  setCustomerPhoneNumber: (phoneNumber: string | null) => void;
}>((set) => ({
  customerPhoneNumber: null,
  setCustomerPhoneNumber: (phoneNumber) => set({ customerPhoneNumber: phoneNumber }),
}));


/**
 * Logs
 */
export interface LiveClientToolResponse {
  functionResponses?: FunctionResponse[];
}
export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface ConversationTurn {
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  text: string;
  isFinal: boolean;
  toolUseRequest?: LiveServerToolCall;
  toolUseResponse?: LiveClientToolResponse;
  groundingChunks?: GroundingChunk[];
}

export const useLogStore = create<{
  turns: ConversationTurn[];
  inputTokens: number;
  outputTokens: number;
  lastSessionTokens: number | null;
  lastSessionAnalysis: Analysis | null;
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (update: Partial<ConversationTurn>) => void;
  clearTurns: () => void;
  addTokens: (input: number, output: number) => void;
  resetTokens: () => void;
  setLastSessionTokens: (total: number) => void;
  setLastSessionAnalysis: (analysis: Analysis | null) => void;
}>((set, get) => ({
  turns: [],
  inputTokens: 0,
  outputTokens: 0,
  lastSessionTokens: null,
  lastSessionAnalysis: null,
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) =>
    set(state => ({
      turns: [...state.turns, { ...turn, timestamp: new Date() }],
    })),
  updateLastTurn: (update: Partial<Omit<ConversationTurn, 'timestamp'>>) => {
    set(state => {
      if (state.turns.length === 0) {
        return state;
      }
      const newTurns = [...state.turns];
      const lastTurn = { ...newTurns[newTurns.length - 1], ...update };
      newTurns[newTurns.length - 1] = lastTurn;
      return { turns: newTurns };
    });
  },
  clearTurns: () => set({ turns: [] }),
  addTokens: (input: number, output: number) => set(state => ({
    inputTokens: state.inputTokens + input,
    outputTokens: state.outputTokens + output
  })),
  resetTokens: () => set({ inputTokens: 0, outputTokens: 0 }),
  setLastSessionTokens: (total: number) => set({ lastSessionTokens: total }),
  setLastSessionAnalysis: (analysis: Analysis | null) => set({ lastSessionAnalysis: analysis }),
}));