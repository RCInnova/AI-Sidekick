/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { useLogStore } from '../../../lib/state';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';

export interface Analysis {
  summary: string;
  insights: string[];
  actionItems: string[];
  sentiment: {
    overall: string;
    topics: {
      topic: string;
      sentiment: string;
    }[];
  };
  diarizedTranscript?: {
    speaker: string;
    text: string;
  }[];
}

interface AnalysisDashboardProps {
  analysis: Analysis | null;
  isAnalyzing: boolean;
  suggestions: string[];
  retrievedContext: string[] | null;
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ analysis, isAnalyzing, suggestions, retrievedContext }) => {
  const { inputTokens, outputTokens } = useLogStore();
  const { client } = useLiveAPIContext();

  const handleSuggestionClick = (suggestion: string) => {
    // Add the suggestion as a user turn in the transcript
    useLogStore.getState().addTurn({
      role: 'user',
      text: suggestion,
      isFinal: true,
    });
    // Send the suggestion to the model to get a response
    client.send([{ text: suggestion }]);
  };


  if (!analysis) {
    return (
      <div className="analysis-dashboard-placeholder">
        <span className="icon">query_stats</span>
        <h3>{isAnalyzing ? 'Generating first analysis...' : 'Waiting for conversation to begin...'}</h3>
        <p>Insights will appear here once there is enough conversation to analyze.</p>
      </div>
    );
  }

  const { summary, insights, actionItems, sentiment, diarizedTranscript } = analysis;

  return (
    <div className="analysis-dashboard">
      <h3>Analysis</h3>
       {retrievedContext && retrievedContext.length > 0 && (
        <div className="analysis-section">
          <h4><span className="icon">history</span>Retrieved Context</h4>
          <div className="retrieved-context-view">
             {retrievedContext.map((context, index) => (
               <p key={index} className="context-entry">
                 {context}
               </p>
            ))}
          </div>
        </div>
      )}
      {summary && (
        <div className="analysis-section">
          <h4><span className="icon">summarize</span>Summary</h4>
          <p>{summary}</p>
        </div>
      )}
      {insights && insights.length > 0 && (
        <div className="analysis-section">
          <h4><span className="icon">insights</span>Key Insights</h4>
          <ul>
            {insights.map((insight, index) => (
              <li key={index}>{insight}</li>
            ))}
          </ul>
        </div>
      )}
      {actionItems && actionItems.length > 0 && (
        <div className="analysis-section">
          <h4><span className="icon">task_alt</span>Action Items</h4>
          <ul>
            {actionItems.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {sentiment && (
        <div className="analysis-section">
           <h4><span className="icon">sentiment_satisfied</span>Sentiment Analysis</h4>
           {sentiment.overall && (
             <div className="sentiment-topic">
               <span className="topic-name">Overall Sentiment</span>
               <span className={`topic-sentiment sentiment-${sentiment.overall}`}>{sentiment.overall}</span>
             </div>
           )}
          {sentiment.topics && sentiment.topics.map((topicItem, index) => (
             <div key={index} className="sentiment-topic">
              <span className="topic-name">{topicItem.topic}</span>
               <span className={`topic-sentiment sentiment-${topicItem.sentiment}`}>{topicItem.sentiment}</span>
             </div>
          ))}
        </div>
      )}
      {diarizedTranscript && diarizedTranscript.length > 0 && (
        <div className="analysis-section">
          <h4><span className="icon">record_voice_over</span>Diarized Transcript</h4>
          <div className="diarized-transcript-view">
            {diarizedTranscript.map((entry, index) => (
              <div key={index} className="diarized-entry">
                <span className="speaker-label">{entry.speaker}:</span>
                <span className="speaker-text">{entry.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {suggestions && suggestions.length > 0 && (
        <div className="analysis-section">
          <h4><span className="icon">assistant_navigation</span>Suggestions</h4>
          <div className="suggestions-container">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="suggestion-chip"
                onClick={() => handleSuggestionClick(suggestion)}
                title="Send this to the assistant"
              >
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="analysis-section">
        <h4><span className="icon">token</span>Token Usage</h4>
        <div className="token-usage-container">
          <div className="token-count">
            <span className="token-label">Input Tokens</span>
            <span className="token-value">{inputTokens}</span>
          </div>
          <div className="token-count">
            <span className="token-label">Output Tokens</span>
            <span className="token-value">{outputTokens}</span>
          </div>
           <div className="token-count total">
            <span className="token-label">Total</span>
            <span className="token-value">{inputTokens + outputTokens}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDashboard;