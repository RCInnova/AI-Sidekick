

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

import ControlTray from './components/console/control-tray/ControlTray';
import ErrorScreen from './components/demo/ErrorScreen';
import StreamingConsole from './components/demo/streaming-console/StreamingConsole';
import Modal from './components/Modal';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { LiveAPIProvider } from './contexts/LiveAPIContext';
import { useUI } from './lib/state';

// FIX: The API key must be obtained exclusively from the environment variable `process.env.API_KEY`.
const API_KEY = process.env.API_KEY as string;
if (typeof API_KEY !== 'string') {
  throw new Error(
    'Missing required environment variable: API_KEY'
  );
}

/**
 * Main application component that provides a streaming interface for Live API.
 * Manages video streaming state and provides controls for webcam/screen capture.
 */
function App() {
  const { error, setError } = useUI();
  return (
    <div className="App">
      <LiveAPIProvider apiKey={API_KEY}>
        <ErrorScreen />
        <Header />
        <Sidebar />
        <div className="streaming-console">
          <main>
            <div className="main-app-area">
              <StreamingConsole apiKey={API_KEY} />
            </div>
            <ControlTray></ControlTray>
          </main>
        </div>
      </LiveAPIProvider>
      {error && (
        <Modal onClose={() => setError(null)}>
          <div className="error-modal-content">
            <h3>System Audio Error</h3>
            <div className="error-modal-body">
              {error.split('\n\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
            <div className="modal-actions">
              <button
                onClick={() => setError(null)}
                className="ok-button"
              >
                OK
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default App;