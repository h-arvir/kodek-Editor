import { useEffect, useRef, useState } from 'react';

import { compileCode } from '../components/api/api-service';
import { useCollaboration } from '../context/collabration';

export function useCodeExecution({ onNewOutput } = {}) {
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { handleCodeOutput } = useCollaboration();

  // Stable ref so the remote-output listener never needs re-registration
  const onNewOutputRef = useRef(onNewOutput);
  useEffect(() => { onNewOutputRef.current = onNewOutput; });

  const getTimestamp = () => new Date().toLocaleTimeString();

  const runCode = async (code, languageId) => {
    setIsLoading(true);

    const runningMsg = `\n\x1b[2m[${getTimestamp()}]\x1b[0m \x1b[36mRunning...\x1b[0m\n`;
    onNewOutputRef.current?.(runningMsg);
    setOutput((prev) => prev + runningMsg);

    try {
      const result = await compileCode(code, languageId);
      let resultOutput = '';

      if (result.status.id === 3) {
        const timeStr   = result.time ? ` · ${result.time}s` : '';
        const stdout    = (result.stdout || '(no output)').trimEnd();
        resultOutput    = `\x1b[32m✓ Execution successful${timeStr}\x1b[0m\n\n${stdout}\n`;
      } else if (result.status.id === 6) {
        const compOut   = (result.compile_output || '').trimEnd();
        resultOutput    = `\x1b[31m✗ Compilation error\x1b[0m\n\n${compOut}\n`;
      } else {
        const errMsg    = (result.stderr || result.compile_output || result.message || 'Unknown error').trimEnd();
        resultOutput    = `\x1b[31m✗ ${result.status.description}\x1b[0m\n\n${errMsg}\n`;
      }

      onNewOutputRef.current?.(resultOutput);
      setOutput((prev) => prev + resultOutput);
      handleCodeOutput(resultOutput);
    } catch (error) {
      const errMsg = `\x1b[31m✗ Error: ${error.message}\x1b[0m\n`;
      onNewOutputRef.current?.(errMsg);
      setOutput((prev) => prev + errMsg);
      handleCodeOutput(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const clearOutput = () => setOutput('');

  // Write remote execution output to the local terminal too
  useEffect(() => {
    const handleRemoteOutput = (event) => {
      const { username, output: remoteOutput } = event.detail;
      const formatted = `\n\x1b[2mOutput from ${username}:\x1b[0m\n${remoteOutput}`;
      onNewOutputRef.current?.(formatted);
      setOutput((prev) => prev + formatted);
    };

    window.addEventListener('remoteCodeOutput', handleRemoteOutput);
    return () => window.removeEventListener('remoteCodeOutput', handleRemoteOutput);
  }, []);

  return { output, setOutput, isLoading, runCode, clearOutput };
}
