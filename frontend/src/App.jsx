import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Activity, Terminal, ExternalLink } from 'lucide-react';
import { WebSocketClient } from './api/websocket';
import AudioVisualizer from './components/AudioVisualizer';
import { motion } from 'framer-motion';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [logs, setLogs] = useState([]);
  const [analyser, setAnalyser] = useState(null);

  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);

  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('en');

  // Broadcast config changes
  useEffect(() => {
    if (isConnected && wsRef.current) {
      const configMsg = JSON.stringify({
        type: 'config',
        source: sourceLang,
        target: targetLang
      });
      wsRef.current.send(configMsg);
      addLog(`Config: Source=${sourceLang}, Target=${targetLang}`);
    }
  }, [isConnected, sourceLang, targetLang]);

  const addLog = (msg) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  useEffect(() => {
    wsRef.current = new WebSocketClient(
      'ws://localhost:3000/ws',
      (event) => {
        if (event.data instanceof Blob) {
          addLog('Received Audio Blob');
          const url = URL.createObjectURL(event.data);
          const audio = new Audio(url);
          audio.play();
        } else {
          addLog(`Server: ${event.data}`);
        }
      },
      () => {
        setIsConnected(true);
        addLog('Connected to Backend');
      },
      () => {
        setIsConnected(false);
        addLog('Disconnected from Backend');
      }
    );
    wsRef.current.connect();

    return () => wsRef.current.disconnect();
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyserNode = audioContextRef.current.createAnalyser();
      analyserNode.fftSize = 256;
      source.connect(analyserNode);
      setAnalyser(analyserNode);

      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current) {
          // Send raw blob or array buffer
          wsRef.current.send(event.data);
        }
      };
      mediaRecorderRef.current.start(100); // 100ms chunks
      setIsRecording(true);
      addLog('Started recording...');
    } catch (err) {
      console.error(err);
      addLog(`Error accessing microphone: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      setIsRecording(false);
      setAnalyser(null);
      addLog('Stopped recording.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans selection:bg-nvidia-green selection:text-black">
      <header className="max-w-7xl mx-auto flex justify-between items-center mb-12 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-nvidia-green rounded flex items-center justify-center font-bold text-black text-xl">N</div>
          <h1 className="text-3xl font-bold tracking-tight">NVIDIA NIM <span className="text-nvidia-green font-light">Speech Lab</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-nvidia-green' : 'bg-red-500'} animate-pulse`}></div>
          <span className="text-sm font-medium text-gray-400">{isConnected ? 'System Online' : 'Connecting...'}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Controls & Visualization */}
        <div className="space-y-8">
          <section className="bg-nvidia-dark/50 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-2xl">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Activity className="text-nvidia-green" /> Live Audio Stream
            </h2>

            <div className="bg-black/80 rounded-xl h-48 mb-6 flex items-center justify-center overflow-hidden relative">
              {isRecording ? (
                <div className="w-full h-full p-2"><AudioVisualizer analyser={analyser} /></div>
              ) : (
                <p className="text-gray-500 text-sm">Waiting for input...</p>
              )}
            </div>

            <div className="flex gap-4">
              {!isRecording ? (
                <button onClick={startRecording} className="flex-1 bg-nvidia-green hover:bg-green-500 text-black font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2">
                  <Mic size={24} /> Start Voice Session
                </button>
              ) : (
                <button onClick={stopRecording} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2">
                  <MicOff size={24} /> End Session
                </button>
              )}
            </div>
          </section>

          {/* Language Configuration */}
          <section className="bg-nvidia-dark/50 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <ExternalLink size={20} className="text-gray-400" /> Language Settings
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase text-gray-500 font-bold mb-2">I am speaking:</label>
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:border-nvidia-green focus:outline-none"
                >
                  <option value="en">English (US)</option>
                  <option value="zh">Mandarin (ZH)</option>
                  <option value="ru">Russian (RU)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase text-gray-500 font-bold mb-2">Translate to:</label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:border-nvidia-green focus:outline-none"
                >
                  <option value="en">English (US)</option>
                  <option value="zh">Mandarin (ZH)</option>
                  <option value="ru">Russian (RU)</option>
                </select>
              </div>
            </div>
          </section>

          <section className="bg-nvidia-dark/50 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-xl">
            {/* ... Voice Cloning ... */}
            <div className="space-y-4 text-gray-400">
              <div className="bg-black/40 p-4 rounded-lg border border-white/5">
                <p className="text-xs uppercase tracking-wider mb-2 font-bold text-gray-500">Target Voice</p>
                <div className="flex items-center justify-between">
                  <span className="text-white">Zero-Shot Reference</span>
                  <span className="px-2 py-1 bg-nvidia-green/20 text-nvidia-green text-xs rounded">Default</span>
                </div>
              </div>
              <p className="text-sm">Upload a detailed audio sample to clone specific voice characteristics via NVIDIA NIM.</p>
            </div>
          </section>
        </div>

        {/* Right Column: Logs & Debugging */}
        <div className="bg-[#0c0c0c] rounded-2xl border border-white/10 flex flex-col h-[600px]">
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-2xl">
            <h2 className="font-mono text-sm font-bold text-gray-300 flex items-center gap-2">
              <Terminal size={16} /> SYSTEM LOGS
            </h2>
            <button onClick={() => setLogs([])} className="text-xs text-gray-500 hover:text-white transition-colors">Clear</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2">
            {logs.length === 0 && <span className="text-gray-700">No activity recorded...</span>}
            {logs.map((log, i) => (
              <div key={i} className="border-l-2 border-nvidia-green/30 pl-3 py-1">
                <span className="text-gray-500 table-cell">{log.split(']')[0]}]</span>
                <span className="text-gray-300 pl-2">{log.split(']')[1]}</span>
              </div>
            ))}
          </div>

          {/* Debug Input */}
          <div className="p-4 border-t border-white/10 bg-white/5">
            <input
              type="text"
              placeholder="Type '/speak <text>' to test TTS..."
              className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-nvidia-green transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && wsRef.current) {
                  const text = e.target.value;
                  wsRef.current.send(text);
                  addLog(`Sent: ${text}`);
                  e.target.value = '';
                }
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
