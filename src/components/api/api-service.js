// API key lives on the backend (server/index.js). The frontend only calls our own proxy.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

const POLLING_INTERVAL_MS = 1500;
const MAX_POLLING_ATTEMPTS = 10;

/**
 * Submits code to the backend execution proxy, which forwards it to Judge0.
 * Polling is handled server-side; this call waits for the final result.
 *
 * @param {string} code - Source code to compile/run
 * @param {number} languageId - Judge0 language ID
 * @returns {Promise<Object>} Judge0 result object
 */
export const compileCode = async (code, languageId) => {
  try {
    const res = await fetch(`${SERVER_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_code: code,
        language_id: languageId,
        stdin: '',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${res.status}`);
    }

    return res.json();
  } catch (error) {
    console.error('Execution request failed:', error);
    throw new Error(`Compilation failed: ${error.message}`);
  }
};
