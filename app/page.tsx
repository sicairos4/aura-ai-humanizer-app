// app/page.tsx
'use client'; // This directive is crucial for client-side components in Next.js App Router

import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, LoaderCircle, Copy, Check, Info, Share2, ChevronDown } from 'lucide-react';
import { Header } from '@/components/Header'; // Assuming your Header component is located here

// Define the type for a persona to improve type safety
interface Persona {
  id: string;
  name: string;
  identity?: string;
  voiceTone?: string;
  coreRule?: string;
  coreGoal?: string;
  isCustom?: boolean; // Added for the 'custom' option
}

export default function HomePage() {
  const [inputText, setInputText] = useState<string>('');
  const [personas, setPersonas] = useState<Persona[]>([]); // State to store fetched personas
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('david'); // Default to David's voice or first available
  
  // Custom persona details for the input fields
  const [customPersonaDetails, setCustomPersonaDetails] = useState<Omit<Persona, 'id' | 'isCustom'>>({
    name: '',
    identity: '',
    voiceTone: '',
    coreRule: '', // Or coreGoal, depending on what the user defines
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [outputText, setOutputText] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<any>(null); // Assuming analysisResult structure
  const [error, setError] = useState<string | null>(null); // Changed to string | null for clarity
  const [hasCopied, setHasCopied] = useState<boolean>(false);

  // --- Initial Data Fetching ---
  useEffect(() => {
    async function fetchPersonasData() {
      try {
        const res = await fetch('/api/personas'); // Fetch from your new API route
        if (!res.ok) {
          throw new Error('Failed to fetch personas from API.');
        }
        const data: Persona[] = await res.json();
        
        // Sort personas by name for display in dropdown, and set default
        const sortedPersonas = data.slice().sort((a, b) => a.name.localeCompare(b.name));
        setPersonas(sortedPersonas);
        
        // Set an initial selected persona if 'david' is not found or is the only option
        if (sortedPersonas.length > 0) {
          const defaultPersona = sortedPersonas.find(p => p.id === 'david') || sortedPersonas[0];
          setSelectedPersonaId(defaultPersona.id);
        }
      } catch (err: any) {
        console.error("Failed to load personas:", err);
        setError(err.message || "Failed to load personas for selection.");
      }
    }
    fetchPersonasData();
  }, []); // Empty dependency array means this runs once on component mount

  // This useMemo is now less critical as the full persona object isn't always needed on frontend
  // but it can still be useful for displaying persona description if you want to add it back
  const selectedPersona = useMemo(() => personas.find(p => p.id === selectedPersonaId), [selectedPersonaId, personas]);

  // --- Helper to normalize newlines ---
  // This function will remove excessive newlines, ensuring single spacing between paragraphs.
  const normalizeOutputText = (text: string): string => {
    if (!text) return '';
    // Replace multiple newlines with exactly two for consistent paragraph breaks,
    // then trim any leading/trailing newlines.
    // .replace(/\r\n|\r/g, '\n') handles different line endings first.
    // .replace(/\n\s*\n\s*\n/g, '\n\n') replaces three or more newlines (potentially with spaces) with two.
    return text.replace(/\r\n|\r/g, '\n').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
  };


  // --- Handlers ---
  const handlePersonaChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const id = event.target.value;
    setSelectedPersonaId(id);
    // If "Custom Persona" is selected, reset custom details fields
    if (id === 'custom') {
      setCustomPersonaDetails({ name: '', identity: '', voiceTone: '', coreRule: '', coreGoal: '' });
    }
  };

  const handleCustomPersonaChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setCustomPersonaDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleHumanize = async () => {
    if (!inputText.trim() || isLoading) return; // Disable if no input or already loading

    setIsLoading(true);
    setAnalysisResult(null); // Clear previous analysis
    setOutputText(''); // Clear previous output
    setError(null); // Clear previous errors

    let payload: { inputText: string; personaId?: string; customPersonaDetails?: Omit<Persona, 'id' | 'isCustom' | 'name'> }; // Exclude 'name' as it's not needed in customPersonaDetails sent to backend

    if (selectedPersonaId === 'custom') {
      // Validate custom persona fields before sending
      if (!customPersonaDetails.name.trim() || !customPersonaDetails.identity.trim() || !customPersonaDetails.voiceTone.trim()) {
        setError("Please provide a name, identity, and voice/tone for your custom persona.");
        setIsLoading(false);
        return;
      }
      // Omit 'name' from customPersonaDetails when sending to backend, as the backend constructs the PROFILE block
      const { name, ...detailsWithoutName } = customPersonaDetails;
      payload = {
        inputText,
        personaId: 'custom', // Indicate to the backend that this is a custom persona
        customPersonaDetails: detailsWithoutName, // Send the cleaned custom object
      };
    } else {
      payload = {
        inputText,
        personaId: selectedPersonaId, // Just send the ID for predefined personas
      };
    }

    try {
      const response = await fetch('/api/humanize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'An unknown error occurred during humanization.');
      }

      const data = await response.json();
      // Apply the normalization to the humanized text before setting it
      setOutputText(normalizeOutputText(data.humanizedText));
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  // Preserve existing handleAnalyze, handleCopy, handleShare functions
  const handleAnalyze = async () => {
    if (!inputText.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setOutputText(''); // Clear output text when analyzing
    setAnalysisResult(null);
    setError(null);
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inputText }) });
      if (!response.ok) throw new Error((await response.json()).error || 'An error occurred.');
      const data = await response.json();
      setAnalysisResult(data.analysisData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleCopy = () => {
    if (outputText) {
      navigator.clipboard.writeText(outputText);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }
  };
  
  const handleShare = () => {
    if (navigator.share && outputText) {
      navigator.share({ title: 'Text from Aura AI', text: outputText }).catch(console.error);
    } else {
      // Fallback to copy if Web Share API is not available
      handleCopy();
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-black bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:3rem_3rem]"></div>
      
      <Header />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6 pb-12">
        
        <div className="w-full max-w-lg mx-auto space-y-3">
          <div className="relative text-center">
            <label htmlFor="persona-select" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Persona
            </label>
            <select
                id="persona-select"
                value={selectedPersonaId}
                onChange={handlePersonaChange}
                className="w-full appearance-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 py-2.5 pl-4 pr-10 text-center text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
                {personas.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <ChevronDown size={18} className="absolute right-3 top-1/2 mt-3 text-gray-500 pointer-events-none" />
          </div>

          {/* Custom Persona Input Fields */}
          {selectedPersonaId === 'custom' && (
            <div className="p-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 space-y-3">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Define Your Custom Persona</h3>
              <div>
                <label htmlFor="custom-name" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Name</label>
                <input
                  id="custom-name"
                  type="text"
                  name="name"
                  value={customPersonaDetails.name}
                  onChange={handleCustomPersonaChange}
                  placeholder="e.g., My Professional Voice"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="custom-identity" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Identity</label>
                <textarea
                  id="custom-identity"
                  name="identity"
                  value={customPersonaDetails.identity}
                  onChange={handleCustomPersonaChange}
                  placeholder="Who is this persona? e.g., A seasoned marketing executive."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                  required
                ></textarea>
              </div>
              <div>
                <label htmlFor="custom-voice-tone" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Voice & Tone</label>
                <textarea
                  id="custom-voice-tone"
                  name="voiceTone"
                  value={customPersonaDetails.voiceTone}
                  onChange={handleCustomPersonaChange}
                  placeholder="Describe the style: e.g., Informal, witty, and engaging. Avoid corporate jargon."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                  required
                ></textarea>
              </div>
              <div>
                <label htmlFor="custom-core-rule" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Core Rule/Goal (Optional)</label>
                <textarea
                  id="custom-core-rule"
                  name="coreRule" 
                  value={customPersonaDetails.coreRule || customPersonaDetails.coreGoal || ''}
                  onChange={handleCustomPersonaChange}
                  placeholder="Specific instructions for the persona. e.g., Always use analogies. Do not use contractions."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                ></textarea>
              </div>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-start">
          
          <div className="bg-white/70 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-lg shadow-sm flex flex-col h-full backdrop-blur-sm min-h-[40vh]">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                <label htmlFor="input-text" className="text-sm font-semibold text-gray-500 dark:text-gray-400">Input Text</label>
            </div>
            <textarea
              id="input-text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your text here to be humanized or analyzed..."
              rows={15} 
              className="w-full flex-grow p-3 text-sm font-normal text-gray-800 dark:text-gray-200 bg-transparent border-none rounded-b-lg focus:outline-none resize-none"
            />
          </div>

          <div className="flex flex-row lg:flex-col gap-4 justify-center items-center w-full lg:h-full lg:py-12">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || isLoading || !inputText.trim()}
              className="flex items-center justify-center gap-2 w-full lg:w-auto px-4 py-2 text-sm font-medium rounded-md border focus:outline-none transition-all disabled:opacity-50
                border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700
                focus:ring-2 focus:ring-purple-500"
            >
              {isAnalyzing ? <LoaderCircle size={16} className="animate-spin" /> : <Info size={16}/>}
              <span>{isAnalyzing ? 'Analyzing...' : 'Analyze'}</span>
            </button>
            <button
              onClick={handleHumanize}
              disabled={isLoading || isAnalyzing || !inputText.trim() || (selectedPersonaId === 'custom' && (!customPersonaDetails.name.trim() || !customPersonaDetails.identity.trim() || !customPersonaDetails.voiceTone.trim()))}
              className="flex items-center justify-center gap-3 w-full lg:w-auto px-6 py-3 text-base font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-offset-gray-900 transition-all disabled:opacity-50"
            >
              {isLoading ? <LoaderCircle size={20} className="animate-spin" /> : <Sparkles size={20} />}
              <span>{isLoading ? 'Applying Aura...' : 'Apply Aura'}</span>
            </button>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-lg shadow-sm min-h-[40vh] flex flex-col backdrop-blur-sm">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
              <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">{analysisResult ? "Analysis Report" : "Humanized Output"}</label>
              {outputText && !isLoading && !analysisResult && (
                <div className="flex gap-2">
                  <button onClick={handleCopy} className="p-1 hover:text-purple-600 dark:hover:text-purple-400 transition-colors rounded">
                    {hasCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                  <button onClick={handleShare} className="p-1 hover:text-purple-600 dark:hover:text-purple-400 transition-colors rounded">
                    <Share2 size={16} />
                  </button>
                </div>
              )}
            </div>
            {/* The output display area - now conditionally renders a textarea or the analysis result */}
            {isLoading || isAnalyzing ? (
              <div className="flex justify-center items-center h-full text-gray-500 dark:text-gray-400">
                <LoaderCircle className="animate-spin" /> Working...
              </div>
            ) : (
              <div className="flex-grow p-3 text-sm font-normal text-gray-800 dark:text-gray-200 bg-transparent border-none rounded-b-lg focus:outline-none resize-none overflow-y-auto"> {/* Added resize-none for consistency */}
                {error && <p className="text-red-500 whitespace-pre-wrap">{error}</p>}
                
                {/* Conditionally render textarea for outputText */}
                {outputText && !analysisResult && (
                    <textarea
                        value={normalizeOutputText(outputText)} /* Applied normalizeOutputText here */
                        readOnly
                        rows={15} 
                        className="w-full h-full p-0 text-sm font-normal text-gray-800 dark:text-gray-200 bg-transparent border-none focus:outline-none resize-none"
                        style={{ lineHeight: '1.5em' }}
                    />
                )}
                {/* Conditionally render analysis result */}
                {analysisResult && (
                  <div className="space-y-2">
                    <p><strong className="font-semibold">Style Name:</strong> {analysisResult.writing_style_name}</p>
                    <p><strong className="font-semibold">Primary Tone:</strong> {analysisResult.primary_tone} ({analysisResult.language})</p>
                    <div className="space-y-1">
                      <p><strong className="font-semibold">Clarity:</strong> {analysisResult.scores.clarity}/100</p>
                      <p><strong className="font-semibold">Confidence:</strong> {analysisResult.scores.confidence}/100</p>
                      <p><strong className="font-semibold">Formality:</strong> {analysisResult.scores.formality}/100</p>
                      <p><strong className="font-semibold">Engagement:</strong> {analysisResult.scores.engagement}/100</p>
                    </div>
                    {analysisResult.improvement_tips && analysisResult.improvement_tips.length > 0 && (
                      <div className="pt-2">
                        <p className="font-semibold">Improvement Tips:</p>
                        <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                          {analysisResult.improvement_tips.map((tip: string, i: number) => <li key={i}>{tip}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}