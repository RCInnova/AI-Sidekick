/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import WelcomeScreen from '../welcome-screen/WelcomeScreen';
import {
  GoogleGenAI,
  Type,
  GenerateContentResponse,
  Modality,
} from '@google/genai';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { useSettings, useLogStore, useSessionStore } from '../../../lib/state';
import AnalysisDashboard, { Analysis } from './AnalysisDashboard';
import { firestoreService } from '../../../lib/firestoreService';

const ANALYSIS_INTERVAL_MS = 10000; // 10 seconds

const formatTimestamp = (date: Date) => {
  const pad = (num: number, size = 2) => num.toString().padStart(size, '0');
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${hours}:${minutes}:${seconds}`;
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: 'A concise, running summary of the conversation so far.',
    },
    insights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Key insights, talking points, or questions raised.',
    },
    actionItems: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'A list of specific action items or tasks that were mentioned.',
    },
    sentiment: {
      type: Type.OBJECT,
      properties: {
        overall: {
          type: Type.STRING,
          description:
            'The overall sentiment of the conversation (e.g., Positive, Neutral, Negative, Mixed).',
        },
        topics: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              sentiment: { type: Type.STRING },
            },
          },
          description:
            'Sentiment analysis for specific key topics discussed.',
        },
      },
    },
    diarizedTranscript: {
      type: Type.ARRAY,
      description: 'The transcript, with each part attributed to a speaker (e.g., "Speaker 1", "Speaker 2").',
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING },
          text: { type: Type.STRING },
        },
        required: ['speaker', 'text'],
      },
    },
  },
};

const suggestionsSchema = {
    type: Type.OBJECT,
    properties: {
        suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Three short, relevant next sentences or questions the user could say.'
        },
    },
    required: ['suggestions'],
};

export default function StreamingConsole({ apiKey }: { apiKey: string }) {
  const { client, sessionState, setConfig, isSystemAudioConnected } = useLiveAPIContext();
  const {
    voice,
    isAudioOutputEnabled,
    summaryDetail,
    insightsDetail,
    actionItemsDetail,
    isDiarizationEnabled,
  } = useSettings();
  const { turns, inputTokens, outputTokens, setLastSessionTokens } = useLogStore();
  const { customerPhoneNumber, setCustomerPhoneNumber } = useSessionStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef('');
  const analysisIntervalRef = useRef<number | null>(null);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [retrievedContext, setRetrievedContext] = useState<string[] | null>(null);

  const ai = useMemo(() => new GoogleGenAI({ apiKey }), [apiKey]);

  // Fetch context when a session starts with a phone number
  useEffect(() => {
    const fetchContext = async () => {
        if (sessionState === 'listening' && customerPhoneNumber && !retrievedContext) {
            console.log(`Fetching context for ${customerPhoneNumber}...`);
            const context = await firestoreService.getCustomerContextByPhoneNumber(customerPhoneNumber);
            if (context.length > 0) {
                setRetrievedContext(context);
            }
        }
    };
    fetchContext();
  }, [sessionState, customerPhoneNumber, retrievedContext]);

  const callAnalysisAPI = useCallback(async () => {
    if (transcriptRef.current.trim().length < 50) {
      console.log('Not enough content to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setSuggestions([]);
    console.log('Analyzing transcript...');

    try {
      // Step 1: Build the main analysis prompt with the retrieved context
      const analysisPrompt = [
        `You are a meeting assistant. Your role is to analyze the meeting transcript.`,
      ];

      if (retrievedContext && retrievedContext.length > 0) {
        analysisPrompt.push(
          'Use the following "Customer Context" from past interactions to provide more relevant and informed analysis.',
          '\n--- START OF CUSTOMER CONTEXT ---\n',
          ...retrievedContext.map(snippet => `- ${snippet}`),
          '\n--- END OF CUSTOMER CONTEXT ---\n'
        );
      }

      analysisPrompt.push(
        `Provide a ${summaryDetail} summary.`,
        `Identify ${insightsDetail} key insights.`,
        `List ${actionItemsDetail} action items.`,
        `Perform sentiment analysis.`,
      )

      if (isSystemAudioConnected) {
        analysisPrompt.push(
          'The transcript contains audio from two sources: the user\'s microphone and system audio. Please provide a diarized transcript, labeling the speakers as "You" for the microphone user and "Participant" for the system audio source.'
        );
      } else if (isDiarizationEnabled) {
        analysisPrompt.push(
          'Additionally, provide a diarized version of the transcript, identifying different speakers (e.g., Speaker 1, Speaker 2).'
        );
      }
      analysisPrompt.push(`\n\nHere is the latest transcript:\n\n${transcriptRef.current}`);

      const fullPrompt = analysisPrompt.join('\n');

      // Step 2: Generate the analysis
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      if (response.usageMetadata) {
        const { promptTokenCount, candidatesTokenCount } = response.usageMetadata;
        useLogStore.getState().addTokens(promptTokenCount ?? 0, candidatesTokenCount ?? 0);
      }

      const jsonStr = response.text.trim();
      const newAnalysis = JSON.parse(jsonStr) as Analysis;
      setAnalysis(newAnalysis);

      // Step 3: Generate suggestions
      console.log('Generating suggestions...');
      const suggestionsResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Based on the following conversation transcript, suggest three short, relevant next sentences or questions the user could say. Keep them concise and natural.\n\nTranscript:\n${transcriptRef.current}`,
        config: {
            responseMimeType: 'application/json',
            responseSchema: suggestionsSchema,
        },
      });

      if (suggestionsResponse.usageMetadata) {
        const { promptTokenCount, candidatesTokenCount } = suggestionsResponse.usageMetadata;
        useLogStore.getState().addTokens(promptTokenCount ?? 0, candidatesTokenCount ?? 0);
      }
      
      const suggestionsJson = JSON.parse(suggestionsResponse.text.trim());
      if (suggestionsJson.suggestions) {
          setSuggestions(suggestionsJson.suggestions);
      }

      if (isAudioOutputEnabled && newAnalysis.summary) {
        console.log('Requesting audio summary...');
        client.send([
          {
            text: `Please provide a brief, one-sentence spoken summary of this: "${newAnalysis.summary}"`,
          },
        ]);
      }
    } catch (error) {
      console.error('Error during analysis or suggestion generation:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [ai.models, isAudioOutputEnabled, client, summaryDetail, insightsDetail, actionItemsDetail, isDiarizationEnabled, isSystemAudioConnected, retrievedContext]);

  useEffect(() => {
    const config: any = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice,
          },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    };
    setConfig(config);
  }, [setConfig, voice]);

  useEffect(() => {
    const { addTurn, updateLastTurn } = useLogStore.getState();

    const handleInputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];

      let newText;
      if (last && !last.isFinal) {
        newText = last.text + text;
        updateLastTurn({ text: newText, isFinal });
      } else {
        newText = text;
        addTurn({ role: 'user', text: newText, isFinal });
      }
      transcriptRef.current = useLogStore.getState().turns.map(t => t.text).join('\n');
    };

    client.on('inputTranscription', handleInputTranscription);

    return () => {
      client.off('inputTranscription', handleInputTranscription);
    };
  }, [client]);

  useEffect(() => {
    const { setLastSessionAnalysis } = useLogStore.getState();

    // Clear interval if it exists
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }

    if (sessionState === 'listening') {
      // Start analysis when listening
      setLastSessionAnalysis(null);
      analysisIntervalRef.current = window.setInterval(() => {
        callAnalysisAPI();
      }, ANALYSIS_INTERVAL_MS);
    } else if (sessionState === 'paused') {
      // Clear interval when paused
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
    } else if (sessionState === 'idle') {
      // Finalize session when idle
      setLastSessionTokens(inputTokens + outputTokens);
      setLastSessionAnalysis(analysis);
      transcriptRef.current = '';
      setAnalysis(null);
      setSuggestions([]);
      setRetrievedContext(null);
      setCustomerPhoneNumber(null); // Clear phone number for next session
    }

    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, [sessionState, callAnalysisAPI, inputTokens, outputTokens, setLastSessionTokens, analysis, setCustomerPhoneNumber]);


  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  if (sessionState === 'idle') {
    return <WelcomeScreen />;
  }

  return (
    <div className="meeting-assistant-container">
      <div className="transcription-panel">
        <h3>Live Transcript</h3>
        <div className="transcription-view" ref={scrollRef}>
          {turns.map((t, i) => (
            <div
              key={i}
              className={`transcription-entry ${!t.isFinal ? 'interim' : ''}`}
            >
              <div className="transcription-header">
                <div className="transcription-source">
                  {formatTimestamp(t.timestamp)}
                </div>
              </div>
              <div className="transcription-text-content">{t.text}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="analysis-panel">
        <AnalysisDashboard analysis={analysis} isAnalyzing={isAnalyzing} suggestions={suggestions} retrievedContext={retrievedContext} />
      </div>
    </div>
  );
}