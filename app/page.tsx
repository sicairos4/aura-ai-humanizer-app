// app/page.tsx
'use client'; 

import React, { useState, useEffect, useMemo } from 'react'; 
import { Sparkles, LoaderCircle, Copy, Check, Info, Share2, ChevronDown } from 'lucide-react';
import { Header } from '@/components/Header'; 

// Define the type for a persona to improve type safety
interface Persona {
  id: string;
  name: string;
  identity?: string;
  voiceTone?: string;
  coreRule?: string;
  coreGoal?: string;
  isCustom?: boolean;
}

// Define a more specific type for analysisResult, assuming its structure
interface AnalysisResult {
  writing_style_name: string;
  primary_tone: string;
  language: string;
  scores: {
    clarity: number;
    confidence: number;
    formality: number;
    engagement: number;
  };
  improvement_tips?: string[];
}


export default function HomePage() {
  const [inputText, setInputText] = useState<string>('');
  const [personas, setPersonas] = useState<Persona[]>([]); 
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('david'); 
  const [wordCount, setWordCount] = useState<number>(0); 
  
  // Custom persona details state, including 'name' as it's an input field
  const [customPersonaDetails, setCustomPersonaDetails] = useState<Omit<Persona, 'id' | 'isCustom'>>({
    name: '', 
    identity: '',
    voiceTone: '',
    coreRule: '',
    coreGoal: '',
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [outputText, setOutputText] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null); 
  const [error, setError] = useState<string | null>(null); 
  const [hasCopied, setHasCopied] = useState<boolean>(false);
  // FIX: Declare displayedAIScore state variable
  const [displayedAIScore, setDisplayedAIScore] = useState<number | null>(null);

  // New state for dynamic loading message
  const [loadingMessage, setLoadingMessage] = useState<string>('Initializing...');
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: Init, 1: Applying Aura, 2: Checking AI, 3: Revising, 4: Finalizing

  // --- Initial Data Fetching ---
  useEffect(() => {
    async function fetchPersonasData() {
      try {
        const res = await fetch('/api/personas'); 
        if (!res.ok) {
          throw new Error('Failed to fetch personas from API.');
        }
        const data: Persona[] = await res.json();
        
        const sortedPersonas = data.slice().sort((a, b) => a.name.localeCompare(b.name));
        setPersonas(sortedPersonas);
        
        if (sortedPersonas.length > 0) {
          const defaultPersona = sortedPersonas.find(p => p.id === 'david') || sortedPersonas[0];
          setSelectedPersonaId(defaultPersona.id);
        }
      } catch (err: unknown) {
        console.error("Failed to load personas:", err);
        setError(err instanceof Error ? err.message : "Failed to load personas for selection.");
      }
    }
    fetchPersonasData();
  }, []); 

  // Effect to cycle loading message based on currentStep
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const baseMessages = [
      "Initializing AI Engine...",
      "Crafting 1st draft of Aura (Gemini)...",
      "Checking for AI fingerprints (ZeroGPT pass 1)...",
      "Refining human touch (revision 1)...",
      "Re-checking for AI patterns (ZeroGPT pass 2)...",
      "Further refining for undetectable output (revision 2)...",
      "Almost done... Compiling output..."
    ];
    const analyzeMessage = "Analyzing input text";

    let dots = 0;
    let messageIndex = 0;

    if (isLoading || isAnalyzing) {
      setLoadingMessage(isAnalyzing ? `${analyzeMessage}` : baseMessages[messageIndex]); 
      intervalId = setInterval(() => {
        dots = (dots % 3) + 1; // Cycle 1, 2, 3 dots
        if (isAnalyzing) {
          setLoadingMessage(`${analyzeMessage}${".".repeat(dots)}`);
        } else {
          messageIndex = (messageIndex + 1) % baseMessages.length; // Cycle through all messages
          setLoadingMessage(`${baseMessages[messageIndex]}${".".repeat(dots)}`);
        }
      }, 750); // Slower cycle for more readability and less frantic feel
    } else {
      setLoadingMessage('Working...'); // Reset message when not loading
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId); // Clean up interval
      }
    };
  }, [isLoading, isAnalyzing, currentStep]); // Rerun effect when loading/analyzing state or step changes


  // Re-added useMemo for selectedPersona to display its details
  const selectedPersona = useMemo(() => personas.find(p => p.id === selectedPersonaId), [selectedPersonaId, personas]);

  // Helper to normalize newlines - now also used for output word count
  const normalizeOutputText = (text: string): string => {
    if (!text) return '';
    return text.replace(/\r\n|\r/g, '\n').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
  };

  // Helper function to calculate words from any given text string.
  const calculateWords = (text: string): number => {
    if (!text) return 0;
    const trimmedText = text.trim();
    if (trimmedText === '') return 0; // Handle case of only whitespace
    return trimmedText.split(/\s+/).filter(word => word.length > 0).length;
  };

  // --- Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    setWordCount(calculateWords(text)); // Use helper function here
  };

  const handlePersonaChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const id = event.target.value;
    setSelectedPersonaId(id);
    if (id === 'custom') {
      setCustomPersonaDetails({ name: '', identity: '', voiceTone: '', coreRule: '', coreGoal: '' });
    }
  };

  const handleCustomPersonaChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setCustomPersonaDetails(prev => ({
      ...prev,
      [name]: value
    }) as Omit<Persona, 'id' | 'isCustom'>);
  };

  const handleHumanize = async () => {
    if (!inputText.trim() || isLoading) return; 

    setIsLoading(true);
    setAnalysisResult(null); 
    setOutputText(''); 
    setError(null); 
    setDisplayedAIScore(null); 
    setCurrentStep(0); // Reset step for humanize (will become 1 in useEffect if loading is true)

    let payload: { inputText: string; personaId?: string; customPersonaDetails?: Omit<Persona, 'id' | 'isCustom'> }; 

    if (selectedPersonaId === 'custom') {
      if (!customPersonaDetails.name?.trim() || !customPersonaDetails.identity?.trim() || !customPersonaDetails.voiceTone?.trim()) { 
        setError("Please provide a name, identity, and voice/tone for your custom persona.");
        setIsLoading(false);
        return;
      }
      payload = {
        inputText,
        personaId: 'custom', 
        customPersonaDetails: customPersonaDetails, 
      };
    } else {
      payload = {
        inputText,
        personaId: selectedPersonaId, 
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
      setOutputText(normalizeOutputText(data.humanizedText));
      setDisplayedAIScore(data.finalAIScore); 
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
      // currentStep is implicitly reset as isLoading becomes false
    }
  };

  const handleAnalyze = async () => {
    if (!inputText.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setOutputText(''); 
    setAnalysisResult(null);
    setError(null);
    setDisplayedAIScore(null); 
    setCurrentStep(5); // Set specific step for analyze loading message

    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inputText }) });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'An error occurred during analysis.');
      }
      const data = await response.json();
      setAnalysisResult(data.analysisData as AnalysisResult); 
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong during analysis.");
    } finally {
      setIsAnalyzing(false);
      // currentStep is implicitly reset as isAnalyzing becomes false
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
      handleCopy();
    }
  };

  return (
    <main className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-gray-100">
      <Header />

      {/* Main content wrapper with controlled width and padding */}
      {/* This is the top-level div for the content, it should encompass everything else */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6 pb-8 sm:pb-12">
        
        {/* Main grid layout for input/buttons/output */}
        {/* Apply max-w-screen-xl directly to this grid container */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 lg:gap-6 items-start px-2 sm:px-0 w-full max-w-screen-xl mx-auto">
          
          {/* Input Text Area Container */}
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-700/50 rounded-lg shadow-sm flex flex-col h-full min-h-[40vh]">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                <label htmlFor="input-text" className="text-sm font-semibold text-gray-500 dark:text-gray-400">Input Text</label>
                <span className="text-xs text-gray-500 dark:text-gray-400">{wordCount} words</span>
            </div>
            <textarea
              id="input-text"
              value={inputText}
              onChange={handleInputChange} 
              placeholder="Paste your text here to be humanized or analyzed..."
              rows={15} 
              className="w-full flex-grow p-3 text-sm font-normal text-gray-800 dark:text-gray-200 bg-transparent border-none rounded-b-lg focus:outline-none resize-none"
            />
          </div> 

          {/* Action Buttons Section */}
          <div className="flex flex-row lg:flex-col gap-3 lg:gap-4 justify-center items-center w-full lg:h-full lg:py-12">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || isLoading || !inputText.trim()}
              className="flex items-center justify-center gap-2 w-full lg:w-auto px-4 py-2 text-sm font-medium rounded-md border focus:outline-none transition-all disabled:opacity-50
                border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700
                focus:ring-2 focus:ring-purple-500"
            >
              {isAnalyzing ? <LoaderCircle size={16} className="animate-spin" /> : <Info size={16}/>}
              <span>{isAnalyzing ? loadingMessage : 'Analyze'}</span>
            </button>
            <button
              onClick={handleHumanize}
              disabled={isLoading || isAnalyzing || !inputText.trim() || (selectedPersonaId === 'custom' && (!customPersonaDetails.name?.trim() || !customPersonaDetails.identity?.trim() || !customPersonaDetails.voiceTone?.trim()))}
              className="flex items-center justify-center gap-3 w-full lg:w-auto px-6 py-3 text-base font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-offset-gray-900 transition-all disabled:opacity-50"
            >
              {isLoading ? <LoaderCircle size={20} className="animate-spin" /> : <Sparkles size={20} />}
              <span>{isLoading ? loadingMessage : 'Apply Aura'}</span>
            </button>
          </div>

          {/* Output Text Area Container */}
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-700/50 rounded-lg shadow-sm min-h-[40vh] flex flex-col">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
              <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">{analysisResult ? "Analysis Report" : "Humanized Output"}</label>
              {/* Output Word Count Display - using the new calculateWords helper */}
              {outputText && !analysisResult ? ( 
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto mr-2">
                  {calculateWords(outputText)} words
                </span>
              ) : null}
              {outputText && !isLoading && !isAnalyzing && !analysisResult && ( 
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
            {isLoading || isAnalyzing ? (
              // Skeleton Loader / Loading Message Display
              <div className="flex-grow p-3 text-sm font-normal text-gray-800 dark:text-gray-200 bg-transparent border-none rounded-b-lg focus:outline-none resize-none overflow-y-auto">
                <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 space-y-4">
                  <LoaderCircle className="animate-spin text-purple-500" size={32} />
                  <span className="text-lg font-semibold">{loadingMessage}</span>
                  {/* Simple text line skeletons for perceived progress */}
                  <div className="w-4/5 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="w-3/5 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="w-4/6 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
            ) : (
              <div className="flex-grow p-3 text-sm font-normal text-gray-800 dark:text-gray-200 bg-transparent border-none rounded-b-lg focus:outline-none resize-none overflow-y-auto">
                {error && <p className="text-red-500 whitespace-pre-wrap">{error}</p>}
                
                {outputText && !analysisResult ? (
                    <textarea
                        value={normalizeOutputText(outputText)}
                        readOnly
                        rows={15} 
                        className="w-full h-full p-0 text-sm font-normal text-gray-800 dark:text-gray-200 bg-transparent border-none focus:outline-none resize-none"
                        style={{ lineHeight: '1.5em' }}
                    />
                ) : null}

                {displayedAIScore !== null && outputText && !analysisResult && (
                    <div className="mt-4 p-3 bg-purple-100 dark:bg-purple-900 border border-purple-300 dark:border-purple-700 rounded-lg text-sm text-purple-800 dark:text-purple-200">
                        <strong className="font-semibold">AI Detection Score: </strong> 
                        <span className={displayedAIScore > 50 ? 'text-red-600 dark:text-red-400' : displayedAIScore > 10 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}>
                            {displayedAIScore}%
                        </span>
                        <p className="mt-1">
                            {displayedAIScore > 50 ? "This text still has significant AI patterns." : 
                             displayedAIScore > 10 ? "Good, but still some AI patterns detected." : 
                             "Great! This text is highly human-like."}
                        </p>
                    </div>
                )}
                
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

        {/* Persona Selector & Custom Persona Inputs - MOVED TO BOTTOM AND STYLED */}
        {/* This div is a direct child of the main content wrapper */}
        <div className="w-full max-w-lg mx-auto space-y-3 px-2 sm:px-0 mt-8 sm:mt-12"> 
          <div className="relative text-center p-4 rounded-lg shadow-lg border-2 border-purple-500 bg-white dark:bg-black">
            <label htmlFor="persona-select" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Persona
            </label>
            <select
                id="persona-select"
                value={selectedPersonaId}
                onChange={handlePersonaChange}
                className="w-full appearance-none rounded-lg border-2 border-purple-400 dark:border-purple-600 bg-white dark:bg-gray-800/50 py-2.5 pl-4 pr-10 text-center text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
                {personas.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <ChevronDown size={18} className="absolute right-3 top-1/2 mt-3 text-gray-500 pointer-events-none" />
          </div>

          {/* Persona Description Display */}
          {selectedPersona && selectedPersona.id !== 'custom' && (
            <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 mt-3"> 
                <p className="font-semibold mb-1">{selectedPersona.name}</p>
                {selectedPersona.identity && <p className="mb-1">{selectedPersona.identity}</p>}
                {selectedPersona.voiceTone && <p>{selectedPersona.voiceTone}</p>}
            </div>
          )}

          {/* Custom Persona Input Fields */}
          {selectedPersonaId === 'custom' && (
            <div className="p-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 space-y-3 mt-3">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Define Your Custom Persona</h3>
              <div>
                <label htmlFor="custom-name" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Name</label>
                <input
                  id="custom-name"
                  type="text"
                  name="name"
                  value={customPersonaDetails.name || ''} 
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
                  value={customPersonaDetails.identity || ''} 
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
                  value={customPersonaDetails.voiceTone || ''} 
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
                  required
                ></textarea>
              </div>
            </div>
          )}
        </div> {/* End of Persona Selector & Custom Persona Inputs block */}

      </div> {/* Final closing div for mx-auto max-w-7xl */}
    </main>
  );
}