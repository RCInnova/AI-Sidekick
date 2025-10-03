/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import './WelcomeScreen.css';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { useLogStore, useSessionStore } from '../../../lib/state';

const WelcomeScreen: React.FC = () => {
  const { connect } = useLiveAPIContext();
  const { lastSessionTokens, lastSessionAnalysis } = useLogStore();
  const { setCustomerPhoneNumber } = useSessionStore();
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleStartListening = () => {
    if (phoneNumber) {
      // Basic sanitization for '+' and numbers
      const sanitizedNumber = phoneNumber.replace(/[^0-9+]/g, '');
      if (sanitizedNumber.length > 5) {
          setCustomerPhoneNumber(sanitizedNumber);
      }
    } else {
      setCustomerPhoneNumber(null);
    }
    connect();
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        {lastSessionAnalysis && (
           <div className="last-session-summary-card">
              <h3>Last Session Summary</h3>
              {lastSessionAnalysis.summary && (
                <div className="summary-section">
                  <h4>Summary</h4>
                  <p>{lastSessionAnalysis.summary}</p>
                </div>
              )}
               {lastSessionAnalysis.insights && lastSessionAnalysis.insights.length > 0 && (
                <div className="summary-section">
                  <h4>Key Insights</h4>
                  <ul>
                    {lastSessionAnalysis.insights.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {lastSessionAnalysis.actionItems && lastSessionAnalysis.actionItems.length > 0 && (
                <div className="summary-section">
                  <h4>Action Items</h4>
                  <ul>
                    {lastSessionAnalysis.actionItems.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
           </div>
        )}
        <div className="title-container">
          <span className="welcome-icon">hub</span>
          <h2 className="welcome-title">Personal Meeting Assistant</h2>
        </div>
        <p>
          Your AI-powered partner for real-time transcription, insights, and summaries.
          Optionally, enter a phone number to retrieve customer context.
        </p>
        <div className="phone-input-container">
          <span className="icon">phone</span>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (555) 123-4567"
            className="phone-input"
            aria-label="Customer Phone Number"
          />
        </div>
        {lastSessionTokens !== null && lastSessionTokens > 0 && (
          <div className="last-session-tokens">
             <span className="icon">token</span>
            Last session total: <strong>{lastSessionTokens} tokens</strong>
          </div>
        )}
        <button className="start-listening-button" onClick={handleStartListening}>
          <span className="icon">play_arrow</span>
          Start Listening
        </button>
        <div className="example-prompts">
          <div className="prompt">Real-time Transcription</div>
          <div className="prompt">Live Summaries</div>
          <div className="prompt">Sentiment Analysis</div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;