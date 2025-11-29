/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@4.5.136/legacy/build/pdf.mjs';
import ePub from 'epubjs';
import { streamWikiDefinition, performAiSearch, streamInDocumentQuery } from './services/geminiService';
import ContentDisplay from './components/ContentDisplay';
import SearchBar from './components/SearchBar';
import LoadingSkeleton from './components/LoadingSkeleton';
import DocumentViewer from './components/DocumentViewer';
import GroundingSourcesDisplay from './components/GroundingSourcesDisplay';

// Set worker source once for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.5.136/legacy/build/pdf.worker.mjs';

const PREDEFINED_WORDS = [
  'Balance', 'Harmony', 'Discord', 'Unity', 'Fragmentation', 'Clarity', 'Ambiguity', 'Presence', 'Absence', 'Creation', 'Destruction', 'Light', 'Shadow', 'Beginning', 'Ending', 'Rising', 'Falling', 'Connection', 'Isolation', 'Hope', 'Despair',
  'Order and chaos', 'Light and shadow', 'Sound and silence', 'Form and formlessness', 'Being and nonbeing', 'Presence and absence', 'Motion and stillness', 'Unity and multiplicity', 'Finite and infinite', 'Sacred and profane', 'Memory and forgetting', 'Question and answer', 'Search and discovery', 'Journey and destination', 'Dream and reality', 'Time and eternity', 'Self and other', 'Known and unknown', 'Spoken and unspoken', 'Visible and invisible',
  'Zigzag', 'Waves', 'Spiral', 'Bounce', 'Slant', 'Drip', 'Stretch', 'Squeeze', 'Float', 'Fall', 'Spin', 'Melt', 'Rise', 'Twist', 'Explode', 'Stack', 'Mirror', 'Echo', 'Vibrate',
  'Gravity', 'Friction', 'Momentum', 'Inertia', 'Turbulence', 'Pressure', 'Tension', 'Oscillate', 'Fractal', 'Quantum', 'Entropy', 'Vortex', 'Resonance', 'Equilibrium', 'Centrifuge', 'Elastic', 'Viscous', 'Refract', 'Diffuse', 'Cascade', 'Levitate', 'Magnetize', 'Polarize', 'Accelerate', 'Compress', 'Undulate',
  'Liminal', 'Ephemeral', 'Paradox', 'Zeitgeist', 'Metamorphosis', 'Synesthesia', 'Recursion', 'Emergence', 'Dialectic', 'Apophenia', 'Limbo', 'Flux', 'Sublime', 'Uncanny', 'Palimpsest', 'Chimera', 'Void', 'Transcend', 'Ineffable', 'Qualia', 'Gestalt', 'Simulacra', 'Abyssal',
  'Existential', 'Nihilism', 'Solipsism', 'Phenomenology', 'Hermeneutics', 'Deconstruction', 'Postmodern', 'Absurdism', 'Catharsis', 'Epiphany', 'Melancholy', 'Nostalgia', 'Longing', 'Reverie', 'Pathos', 'Ethos', 'Logos', 'Mythos', 'Anamnesis', 'Intertextuality', 'Metafiction', 'Stream', 'Lacuna', 'Caesura', 'Enjambment'
];
const UNIQUE_WORDS = [...new Set(PREDEFINED_WORDS)];

interface CachedTopicState {
  content: string;
  generationTime: number | null;
  sources?: any[];
}

const App: React.FC = () => {
  const [currentTopic, setCurrentTopic] = useState<string>('Hypertext');
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [generationTime, setGenerationTime] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // Document/eBook state
  const [documentContext, setDocumentContext] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [isEbookMode, setIsEbookMode] = useState<boolean>(false);
  const [ebookPages, setEbookPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  
  const [cache, setCache] = useState<Map<string, CachedTopicState>>(new Map());
  const [isAiSearchMode, setIsAiSearchMode] = useState<boolean>(false);
  const [groundingSources, setGroundingSources] = useState<any[]>([]);

  const finalContentRef = useRef<string>('');
  const finalSourcesRef = useRef<any[]>([]);

  // Main effect for fetching data or displaying ebook pages
  useEffect(() => {
    // Mode 1: eBook Reading Mode
    if (isEbookMode && !isAiSearchMode) {
      setContent(ebookPages[currentPage] ?? '');
      setIsLoading(false);
      setError(null);
      setGenerationTime(null);
      setGroundingSources([]);
      return; // Stop here for ebook reading
    }
    
    // Mode 2: API-based modes (Wiki, Web Search, Document Search)
    if (!currentTopic) return;

    const cacheKey = `${isAiSearchMode ? 'ai:' : 'wiki:'}${documentName ? `doc(${documentName}):` : ''}${currentTopic.toLowerCase()}`;
    if (cache.has(cacheKey)) {
      const cachedState = cache.get(cacheKey)!;
      setContent(cachedState.content);
      setGenerationTime(cachedState.generationTime);
      setGroundingSources(cachedState.sources ?? []);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      setContent('');
      setGenerationTime(null);
      setGroundingSources([]);
      
      finalContentRef.current = '';
      finalSourcesRef.current = [];
      
      const startTime = performance.now();
      let accumulatedContent = '';

      try {
        if (isAiSearchMode) {
          if (documentContext) {
            // In-document AI search
            for await (const event of streamInDocumentQuery(currentTopic, documentContext)) {
              if (isCancelled) break;
              // FIX: Check if event is a 'chunk' before accessing 'text'
              if (event.type === 'chunk') {
                accumulatedContent += event.text;
                finalContentRef.current = accumulatedContent;
                setContent(accumulatedContent);
              }
            }
          } else {
            // Web AI Search
            const { content: searchContent, sources } = await performAiSearch(currentTopic);
            if (isCancelled) return;
            finalContentRef.current = searchContent;
            finalSourcesRef.current = sources;
            setContent(searchContent);
            setGroundingSources(sources);
          }
        } else {
          // Wiki Mode
          for await (const event of streamWikiDefinition(currentTopic)) {
            if (isCancelled) break;
            // FIX: Check if event is a 'chunk' before accessing 'text'
            if (event.type === 'chunk') {
              accumulatedContent += event.text;
              finalContentRef.current = accumulatedContent;
              setContent(accumulatedContent);
            }
          }
        }
      } catch (e: unknown) {
        if (!isCancelled) {
          const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
          setError(errorMessage);
          setContent('');
          console.error(e);
        }
      } finally {
        if (!isCancelled) {
          const endTime = performance.now();
          const genTime = endTime - startTime;
          setGenerationTime(genTime);
          setIsLoading(false);

          setCache(prevCache => {
            const newCache = new Map(prevCache);
            newCache.set(cacheKey, { content: finalContentRef.current, generationTime: genTime, sources: finalSourcesRef.current });
            return newCache;
          });
        }
      }
    };

    fetchData();
    return () => { isCancelled = true; };
  }, [currentTopic, documentContext, cache, isAiSearchMode, isEbookMode, currentPage, ebookPages]);

  const updateSearchHistory = (topic: string) => {
    setSearchHistory(prev => {
      const newHistory = [ topic, ...prev.filter(item => item.toLowerCase() !== topic.toLowerCase()) ];
      return newHistory.slice(0, 5);
    });
  };

  const handleTopicChange = useCallback((newTopic: string) => {
    if (newTopic && newTopic.toLowerCase() !== currentTopic.toLowerCase()) {
      updateSearchHistory(newTopic);
      if (!isEbookMode) {
        setHistory(prev => [...prev, currentTopic]);
      }
      setCurrentTopic(newTopic);
    }
  }, [currentTopic, isEbookMode]);

  const handleWordClick = useCallback((word: string) => {
    const newTopic = word.trim().replace(/[.,!?;:()"']$/, '');
    handleTopicChange(newTopic);
  }, [handleTopicChange]);

  const handleSearch = useCallback((topic: string) => {
    if (isEbookMode) {
      setIsAiSearchMode(true);
    }
    const newTopic = topic.trim();
    handleTopicChange(newTopic);
  }, [handleTopicChange, isEbookMode]);

  const handleRandom = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * UNIQUE_WORDS.length);
    let randomWord = UNIQUE_WORDS[randomIndex];
    if (randomWord.toLowerCase() === currentTopic.toLowerCase()) {
      randomWord = UNIQUE_WORDS[(randomIndex + 1) % UNIQUE_WORDS.length];
    }
    handleTopicChange(randomWord);
  }, [currentTopic, handleTopicChange]);

  const handleBack = useCallback(() => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const prevTopic = newHistory.pop()!;
    setHistory(newHistory);
    setCurrentTopic(prevTopic);
  }, [history]);

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
      fileReader.onload = async (event) => {
        if (!event.target?.result) return reject(new Error("Failed to load file."));
        try {
          const typedArray = new Uint8Array(event.target.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument(typedArray).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');
            fullText += pageText + '\n\n';
          }
          resolve(fullText.trim());
        } catch (error) {
          reject(new Error("Could not parse the PDF file."));
        }
      };
      fileReader.onerror = () => reject(new Error("Failed to read file."));
      fileReader.readAsArrayBuffer(file);
    });
  };

  const extractContentFromEpub = async (file: File): Promise<{ fullText: string; pages: string[] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (!event.target?.result) return reject(new Error("Failed to load file."));
        try {
          const book = ePub(event.target.result as ArrayBuffer);
          await book.ready;
          const pages: string[] = [];
          let fullText = '';
          
          // FIX: Correctly iterate through epub sections and extract text content.
          // This resolves errors related to incorrect epub.js API usage.
          // FIX: Cast to `any` to work around potentially incorrect epub.js typings for `book.spine.items`.
          for (const sectionInfo of (book.spine as any).items) {
            const section = book.section(sectionInfo.href);
            await section.load();
            if (section.contents) {
              // Fix: Cast to `any` to resolve typing error where section.contents is treated as Element.
              const text = (section.contents as any).body.textContent || '';
              const trimmedText = text.trim();
              if (trimmedText) {
                pages.push(trimmedText);
                fullText += trimmedText + '\n\n';
              }
            }
          }
          resolve({ fullText: fullText.trim(), pages });
        } catch (error) {
          reject(new Error("Could not parse the EPUB file."));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setDocumentContext(null);
    setDocumentName(null);
    setIsEbookMode(false);
    setEbookPages([]);
    setCurrentPage(0);
    try {
      let text = '';
      let pages: string[] = [];

      if (file.type === 'application/epub+zip') {
        const epubContent = await extractContentFromEpub(file);
        text = epubContent.fullText;
        pages = epubContent.pages;
      } else if (file.type === 'application/pdf') {
        text = await extractTextFromPdf(file);
        pages = [text];
      } else {
        text = await file.text();
        pages = [text];
      }
      
      setCache(new Map());
      setDocumentContext(text);
      setEbookPages(pages);
      setDocumentName(file.name);
      setIsEbookMode(true);
      setIsAiSearchMode(false);
      setCurrentPage(0);
      setCurrentTopic(file.name);
      setHistory([]);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error processing file.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleClearDocument = useCallback(() => {
    setCache(new Map());
    setDocumentContext(null);
    setDocumentName(null);
    setIsEbookMode(false);
    setEbookPages([]);
    setCurrentPage(0);
    setIsAiSearchMode(false);
    setCurrentTopic('Hypertext');
    setHistory([]);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }, []);

  const handleViewDocument = useCallback(() => setIsViewerOpen(true), []);

  const handleAiSearchModeChange = useCallback((isAiSearch: boolean) => {
    setIsAiSearchMode(isAiSearch);
    if (!isEbookMode) {
      setHistory([]);
      const defaultTopic = isAiSearch ? 'Latest news in AI' : 'Hypertext';
      setCurrentTopic(defaultTopic);
    } else {
      if (!isAiSearch) {
        setCurrentTopic(documentName || "eBook");
        setCurrentPage(0); 
      }
    }
  }, [isEbookMode, documentName]);

  const handlePrevPage = () => setCurrentPage(p => Math.max(p - 1, 0));
  const handleNextPage = () => setCurrentPage(p => Math.min(p + 1, ebookPages.length - 1));

  const displayTopic = (isEbookMode && !isAiSearchMode) ? (documentName || currentTopic) : currentTopic;

  return (
    <div>
      <SearchBar
        onSearch={handleSearch}
        onRandom={handleRandom}
        isLoading={isLoading}
        onBack={handleBack}
        hasHistory={history.length > 0}
        onFileUpload={handleFileUpload}
        onClearDocument={handleClearDocument}
        documentName={documentName}
        onViewDocument={handleViewDocument}
        searchHistory={searchHistory}
        isAiSearchMode={isAiSearchMode}
        onAiSearchModeChange={handleAiSearchModeChange}
      />
      
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          {isAiSearchMode && !documentName ? 'AI SEARCH' : 
           isEbookMode ? 'DOCUMENT READER' : 'INFINITE WIKI'}
        </h1>
      </header>

      <main>
        <div>
          <h2 style={{ marginBottom: '1rem', textTransform: 'capitalize' }}>
            {displayTopic}
          </h2>

          {isEbookMode && !isAiSearchMode && ebookPages.length > 1 && (
            <div className="pagination-controls">
              <button onClick={handlePrevPage} disabled={isLoading || currentPage === 0}>Previous</button>
              <span>Page {currentPage + 1} of {ebookPages.length}</span>
              <button onClick={handleNextPage} disabled={isLoading || currentPage >= ebookPages.length - 1}>Next</button>
            </div>
          )}

          {error && (
            <div style={{ border: '1px solid #cc0000', padding: '1rem', color: '#cc0000' }}>
              <p style={{ margin: 0 }}>An Error Occurred</p>
              <p style={{ marginTop: '0.5rem', margin: 0 }}>{error}</p>
            </div>
          )}
          
          {isLoading && content.length === 0 && !error && <LoadingSkeleton />}

          {content.length > 0 && !error && (
             <ContentDisplay 
               content={content} 
               isLoading={isLoading} 
               onWordClick={isEbookMode || isAiSearchMode ? undefined : handleWordClick} 
             />
          )}

          {!isLoading && !error && content.length === 0 && (
            <div style={{ color: '#888', padding: '2rem 0' }}>
              <p>Content could not be generated or displayed.</p>
            </div>
          )}

          {groundingSources.length > 0 && <GroundingSourcesDisplay sources={groundingSources} />}
        </div>
      </main>

      <footer className="sticky-footer">
        <p className="footer-text" style={{ margin: 0 }}>
          Infinite Wiki by <a href="https://x.com/dev_valladares" target="_blank" rel="noopener noreferrer">Dev Valladares</a> · Generated by Gemini
          {generationTime && ` · ${Math.round(generationTime)}ms`}
        </p>
      </footer>
      
      {isViewerOpen && (
        <DocumentViewer
          content={documentContext}
          documentName={documentName}
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </div>
  );
};

export default App;