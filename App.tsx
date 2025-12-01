/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@4.5.136/legacy/build/pdf.mjs';
import ePub from 'epubjs';
import mammoth from 'https://esm.sh/mammoth@1.7.2';
import { streamWikiDefinition, performAiSearch, streamInDocumentQuery, streamYouTubeSummary, streamWebResource, streamImageAnalysis, generateInfoDiagram, streamTranslation } from './services/geminiService';
import ContentDisplay from './components/ContentDisplay';
import SearchBar from './components/SearchBar';
import LoadingSkeleton from './components/LoadingSkeleton';
import DocumentViewer from './components/DocumentViewer';
import GroundingSourcesDisplay from './components/GroundingSourcesDisplay';
import TabBar, { TabData } from './components/TabBar';

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
  language?: string;
}

interface FileData {
  base64: string;
  mimeType: string;
}

// Interface for a single tab's state
interface Tab {
  id: string;
  title: string;
  
  // History Stacks
  historyStack: string[];
  futureStack: string[];
  
  // Content State
  currentTopic: string;
  content: string;
  isLoading: boolean;
  error: string | null;
  generationTime: number | null;
  groundingSources: any[];
  
  // Mode & Context
  isWebSearchMode: boolean;
  isEbookMode: boolean;
  documentName: string | null;
  documentContext: string | null;
  // Merged imageData into a general fileData for both images and documents without text
  fileData: FileData | null;
  ebookPages: string[];
  currentPage: number;
  
  // Web Reading State
  webUrl: string | null;
  webSectionIndex: number;
  generatedDiagrams: Record<string, string>; // prompt -> base64

  // Settings
  language: string;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const createNewTab = (id: string = generateId()): Tab => ({
  id,
  title: 'New Tab',
  historyStack: [],
  futureStack: [],
  currentTopic: '',
  content: '',
  isLoading: false,
  error: null,
  generationTime: null,
  groundingSources: [],
  isWebSearchMode: false,
  isEbookMode: false,
  documentName: null,
  documentContext: null,
  fileData: null,
  ebookPages: [],
  currentPage: 0,
  webUrl: null,
  webSectionIndex: 0,
  generatedDiagrams: {},
  language: 'English',
});

const App: React.FC = () => {
  // Tab State Management
  const [tabs, setTabs] = useState<Tab[]>([createNewTab('default-tab')]);
  const [activeTabId, setActiveTabId] = useState<string>('default-tab');
  
  const [cache, setCache] = useState<Map<string, CachedTopicState>>(new Map());
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);

  const finalContentRef = useRef<string>('');
  const finalSourcesRef = useRef<any[]>([]);
  
  // Track diagrams currently being generated to avoid duplicate requests
  const pendingDiagramsRef = useRef<Set<string>>(new Set());

  const updateActiveTab = useCallback((updates: Partial<Tab>) => {
    setTabs(prevTabs => prevTabs.map(tab => 
      tab.id === activeTabId ? { ...tab, ...updates } : tab
    ));
  }, [activeTabId]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  useEffect(() => {
    if (!activeTab.currentTopic && activeTab.id === 'default-tab' && !activeTab.isLoading && !activeTab.content) {
       updateActiveTab({ currentTopic: 'Hypertext', isLoading: true, title: 'Hypertext' });
    }
  }, []);

  // --- Diagram Generation Effect ---
  useEffect(() => {
     if (!activeTab.content) return;
     
     // Detect [DIAGRAM: ...] tags
     const regex = /\[DIAGRAM:\s*(.*?)\]/g;
     let match;
     while ((match = regex.exec(activeTab.content)) !== null) {
       const prompt = match[1];
       if (!activeTab.generatedDiagrams[prompt] && !pendingDiagramsRef.current.has(prompt)) {
         // Start generation
         pendingDiagramsRef.current.add(prompt);
         generateInfoDiagram(prompt).then(base64 => {
           setTabs(prev => prev.map(t => {
             if (t.id === activeTab.id) {
               return {
                 ...t,
                 generatedDiagrams: { ...t.generatedDiagrams, [prompt]: base64 }
               };
             }
             return t;
           }));
         }).catch(e => console.error("Diagram failed", e))
         .finally(() => {
           pendingDiagramsRef.current.delete(prompt);
         });
       }
     }
  }, [activeTab.content, activeTab.id, activeTab.generatedDiagrams]);

  // --- Main Data Fetching ---
  useEffect(() => {
    if (!activeTab.currentTopic) return;
    
    // Ebook Mode (Local File)
    // If we have TEXT content (pagination available)
    if (activeTab.isEbookMode && !activeTab.isWebSearchMode && !activeTab.fileData && activeTab.documentContext) {
      const pageContent = activeTab.ebookPages[activeTab.currentPage] ?? '';
      
      // If language is not English, we need to Translate the page content dynamically.
      if (activeTab.language !== 'English') {
          // If we are already displaying content that seems to match the page AND isn't just the english text (simple heuristic: if loading is true we fetch)
          // We rely on isLoading being set to true when page changes in translation mode.
          if (activeTab.isLoading) {
              // Trigger translation
              let isCancelled = false;
              const fetchTranslation = async () => {
                 let acc = '';
                 try {
                     for await (const event of streamTranslation(pageContent, activeTab.language)) {
                         if (isCancelled) break;
                         if (event.type === 'chunk') {
                             acc += event.text;
                             updateActiveTab({ content: acc });
                         }
                     }
                     updateActiveTab({ isLoading: false });
                 } catch (e) {
                     if (!isCancelled) updateActiveTab({ error: "Translation failed", isLoading: false });
                 }
              };
              fetchTranslation();
              return () => { isCancelled = true; };
          }
      } else {
          // Standard English display
          if (activeTab.content !== pageContent) {
            updateActiveTab({ 
                content: pageContent, 
                isLoading: false, 
                error: null, 
                groundingSources: [] 
            });
          }
      }
      return;
    }

    const cacheKey = `${activeTab.isWebSearchMode ? 'web:' : 'wiki:'}${activeTab.documentName ? `doc(${activeTab.documentName}):` : ''}${activeTab.currentTopic.toLowerCase()}:${activeTab.webSectionIndex}:${activeTab.language}`;
    
    // Simple cache check
    if (cache.has(cacheKey) && !activeTab.isLoading && activeTab.content === '') {
      const cachedState = cache.get(cacheKey)!;
      updateActiveTab({
        content: cachedState.content,
        generationTime: cachedState.generationTime,
        groundingSources: cachedState.sources ?? [],
        error: null,
        isLoading: false,
        title: activeTab.currentTopic
      });
      return;
    }

    if (!activeTab.isLoading) return;

    let isCancelled = false;
    
    const fetchData = async () => {
      finalContentRef.current = '';
      finalSourcesRef.current = [];
      const startTime = performance.now();
      let accumulatedContent = '';

      try {
        const topic = activeTab.currentTopic;
        const trimmedTopic = topic.trim();
        const lang = activeTab.language;
        
        const isYouTubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(trimmedTopic);
        // Robust URL detection
        const isUrl = /^(https?:\/\/[^\s]+\.[^\s]+)/i.test(trimmedTopic);

        // Case 1: Image Analysis (explicitly treated as such if mimeType is image)
        if (activeTab.fileData && activeTab.fileData.mimeType.startsWith('image/')) {
           for await (const event of streamImageAnalysis(topic, activeTab.fileData.base64, activeTab.fileData.mimeType, lang)) {
             if (isCancelled) break;
             if (event.type === 'chunk') {
                accumulatedContent += event.text;
                finalContentRef.current = accumulatedContent;
                setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, content: accumulatedContent } : t));
             }
           }
        } 
        // Case 2: YouTube Video
        else if (isYouTubeUrl) {
           for await (const event of streamYouTubeSummary(trimmedTopic, lang)) {
            if (isCancelled) break;
            if (event.type === 'chunk') {
                if (event.text) accumulatedContent += event.text;
                if (event.sources) finalSourcesRef.current = event.sources;
                finalContentRef.current = accumulatedContent;
                setTabs(prev => prev.map(t => t.id === activeTabId ? { 
                    ...t, 
                    content: accumulatedContent,
                    groundingSources: finalSourcesRef.current 
                } : t));
            }
          }
        } 
        // Case 3: External URL Reading
        else if (isUrl && !activeTab.documentContext && !activeTab.fileData) { 
             for await (const event of streamWebResource(trimmedTopic, activeTab.webSectionIndex, lang)) {
                if (isCancelled) break;
                if (event.type === 'chunk') {
                    if (event.text) accumulatedContent += event.text;
                    if (event.sources) finalSourcesRef.current = event.sources;
                    finalContentRef.current = accumulatedContent;
                    setTabs(prev => prev.map(t => t.id === activeTabId ? { 
                        ...t, 
                        content: accumulatedContent,
                        groundingSources: finalSourcesRef.current 
                    } : t));
                }
            }
        } 
        // Case 4: Web Search Mode (Grounding)
        else if (activeTab.isWebSearchMode) {
          if (activeTab.documentContext || activeTab.fileData) {
            // In-Document Query with possible Web Search enabled (mixed mode not strictly supported by UI yet, but handled here)
             const params = activeTab.fileData 
                ? { mimeType: activeTab.fileData.mimeType, data: activeTab.fileData.base64 } 
                : undefined;
             
            for await (const event of streamInDocumentQuery(topic, activeTab.documentContext, params, lang)) {
              if (isCancelled) break;
              if (event.type === 'chunk') {
                accumulatedContent += event.text;
                finalContentRef.current = accumulatedContent;
                setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, content: accumulatedContent } : t));
              }
            }
          } else {
             // Standard Web Search
             const { content, sources } = await performAiSearch(topic, lang);
             if (isCancelled) return;
             finalContentRef.current = content;
             finalSourcesRef.current = sources;
             setTabs(prev => prev.map(t => t.id === activeTabId ? { 
                 ...t, 
                 content: content, 
                 groundingSources: sources 
             } : t));
          }
        } 
        // Case 5: Document Query (Text or Multimodal/Binary) or Default Wiki
        else {
           if (activeTab.documentContext || activeTab.fileData) {
              const params = activeTab.fileData 
                ? { mimeType: activeTab.fileData.mimeType, data: activeTab.fileData.base64 } 
                : undefined;

              for await (const event of streamInDocumentQuery(topic, activeTab.documentContext, params, lang)) {
                if (isCancelled) break;
                if (event.type === 'chunk') {
                   accumulatedContent += event.text;
                   finalContentRef.current = accumulatedContent;
                   setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, content: accumulatedContent } : t));
                }
              }
           } else {
              // Wiki Definition
              for await (const event of streamWikiDefinition(topic, lang)) {
                  if (isCancelled) break;
                  if (event.type === 'chunk') {
                    if (event.text) accumulatedContent += event.text;
                    if (event.sources) finalSourcesRef.current = event.sources;
                    finalContentRef.current = accumulatedContent;
                    setTabs(prev => prev.map(t => t.id === activeTabId ? { 
                        ...t, 
                        content: accumulatedContent, 
                        groundingSources: finalSourcesRef.current 
                    } : t));
                  }
              }
           }
        }
      } catch (e: unknown) {
        if (!isCancelled) {
          const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
          updateActiveTab({ error: errorMessage, isLoading: false });
          console.error(e);
        }
      } finally {
        if (!isCancelled) {
          const endTime = performance.now();
          const genTime = endTime - startTime;
          
          setCache(prev => {
             const newCache = new Map(prev);
             newCache.set(cacheKey, { 
                 content: finalContentRef.current, 
                 generationTime: genTime, 
                 sources: finalSourcesRef.current,
                 language: activeTab.language 
             });
             return newCache;
          });

          updateActiveTab({ 
              isLoading: false, 
              generationTime: genTime,
              title: activeTab.documentName || activeTab.currentTopic 
          });
        }
      }
    };

    fetchData();

    return () => { isCancelled = true; };
  }, [
      activeTabId, 
      activeTab.currentTopic, 
      activeTab.isLoading, 
      activeTab.isWebSearchMode, 
      activeTab.isEbookMode, 
      activeTab.currentPage,
      activeTab.documentContext,
      activeTab.fileData,
      activeTab.webSectionIndex,
      activeTab.language
  ]);

  const handleTabSwitch = (id: string) => setActiveTabId(id);
  
  const handleNewTab = () => {
    const newTab = createNewTab();
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (id: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== id);
      if (newTabs.length === 0) {
          const def = createNewTab();
          setActiveTabId(def.id);
          return [def];
      }
      if (id === activeTabId) {
          setActiveTabId(newTabs[newTabs.length - 1].id);
      }
      return newTabs;
    });
  };

  const handleTopicChange = useCallback((newTopic: string) => {
    if (!newTopic) return;
    
    setSearchHistory(prev => {
      const newHist = [newTopic, ...prev.filter(item => item.toLowerCase() !== newTopic.toLowerCase())];
      return newHist.slice(0, 5);
    });

    const isUrl = /^(https?:\/\/[^\s]+\.[^\s]+)/i.test(newTopic.trim());

    updateActiveTab({
        historyStack: activeTab.currentTopic ? [...activeTab.historyStack, activeTab.currentTopic] : activeTab.historyStack,
        futureStack: [],
        currentTopic: newTopic,
        content: '', // Clear content
        isLoading: true,
        error: null,
        title: newTopic,
        webUrl: isUrl ? newTopic.trim() : null,
        webSectionIndex: 0, 
        generatedDiagrams: {},
    });
  }, [activeTab.currentTopic, activeTab.historyStack, updateActiveTab, activeTab.isEbookMode]);

  const handleLanguageChange = useCallback((lang: string) => {
    updateActiveTab({ 
      language: lang,
      // If we are in ebook mode (text), we need to trigger a loading state to force the translation effect
      isLoading: true,
      // If NOT in ebook text mode, we also want to trigger fetch
      // If we are in Wiki/Search mode, clear content to restart the stream in new language
      content: activeTab.isEbookMode && !activeTab.isWebSearchMode && !activeTab.fileData ? activeTab.content : '' 
    });
  }, [updateActiveTab, activeTab.isEbookMode, activeTab.isWebSearchMode, activeTab.fileData, activeTab.content]);

  const handleBack = useCallback(() => {
    if (activeTab.historyStack.length === 0) return;
    const prevTopic = activeTab.historyStack[activeTab.historyStack.length - 1];
    const newHistory = activeTab.historyStack.slice(0, -1);
    
    updateActiveTab({
        historyStack: newHistory,
        futureStack: [activeTab.currentTopic, ...activeTab.futureStack],
        currentTopic: prevTopic,
        isLoading: true,
        error: null,
        title: prevTopic,
        webSectionIndex: 0 
    });
  }, [activeTab, updateActiveTab]);

  const handleForward = useCallback(() => {
    if (activeTab.futureStack.length === 0) return;
    const nextTopic = activeTab.futureStack[0];
    const newFuture = activeTab.futureStack.slice(1);

    updateActiveTab({
        historyStack: [...activeTab.historyStack, activeTab.currentTopic],
        futureStack: newFuture,
        currentTopic: nextTopic,
        isLoading: true,
        error: null,
        title: nextTopic,
        webSectionIndex: 0
    });
  }, [activeTab, updateActiveTab]);

  const handleSearch = useCallback((query: string) => {
    const topic = query.trim();
    const isUrl = /^(https?:\/\/[^\s]+\.[^\s]+)/i.test(topic);

    if (activeTab.isEbookMode && !isUrl) {
       // Keep isWebSearchMode as is
    } else if (!activeTab.isEbookMode && !isUrl) {
       // Regular search
    }
    
    handleTopicChange(topic);
  }, [activeTab.isEbookMode, handleTopicChange]);

  const handleWordClick = useCallback((word: string) => {
    const newTopic = word.trim().replace(/[.,!?;:()"']$/, '');
    handleTopicChange(newTopic);
  }, [handleTopicChange]);
  
  const handleRandom = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * UNIQUE_WORDS.length);
    let randomWord = UNIQUE_WORDS[randomIndex];
    if (randomWord.toLowerCase() === activeTab.currentTopic.toLowerCase()) {
      randomWord = UNIQUE_WORDS[(randomIndex + 1) % UNIQUE_WORDS.length];
    }
    handleTopicChange(randomWord);
  }, [activeTab.currentTopic, handleTopicChange]);

  const extractTextFromPdf = async (file: File): Promise<{ fullText: string; pages: string[] }> => {
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
      fileReader.onload = async (event) => {
        if (!event.target?.result) return reject(new Error("Failed to load file."));
        try {
          const typedArray = new Uint8Array(event.target.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument(typedArray).promise;
          const pages: string[] = [];
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');
            if (pageText.trim()) {
                pages.push(pageText.trim());
                fullText += pageText + '\n\n';
            }
          }
          resolve({ fullText: fullText.trim(), pages });
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
          for (const sectionInfo of (book.spine as any).items) {
            const section = book.section(sectionInfo.href);
            await section.load();
            if (section.contents) {
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
  
  const extractTextFromDocx = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (!event.target?.result) return reject(new Error("Failed to load file."));
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: event.target.result as ArrayBuffer });
          resolve(result.value);
        } catch (error) {
          reject(new Error("Could not parse the DOCX file."));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsArrayBuffer(file);
    });
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;
    updateActiveTab({ isLoading: true, error: null });

    try {
      const base64 = await blobToBase64(file);
      let text = '';
      let pages: string[] = [];

      try {
        if (file.type === 'application/epub+zip') {
          const epubContent = await extractContentFromEpub(file);
          text = epubContent.fullText;
          pages = epubContent.pages;
        } else if (file.type === 'application/pdf') {
          const pdfContent = await extractTextFromPdf(file);
          text = pdfContent.fullText;
          pages = pdfContent.pages;
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          text = await extractTextFromDocx(file);
          pages = [text];
        } else if (file.type.startsWith('image/')) {
           text = ''; 
        } else {
          text = await file.text();
          pages = [text];
        }
      } catch (e) {
         console.warn("Text extraction failed or skipped, falling back to binary handling.", e);
         text = '';
      }
      
      if (!text || text.trim().length === 0) {
          console.log("No text extracted. Using Multimodal mode.");
          updateActiveTab({
            fileData: { base64, mimeType: file.type || 'application/octet-stream' },
            documentContext: null,
            ebookPages: [],
            documentName: file.name,
            isEbookMode: true,
            isWebSearchMode: false,
            content: '', 
            currentTopic: 'Analyze Document', 
            title: file.name,
            historyStack: [],
            isLoading: true
          });

      } else {
          updateActiveTab({
            documentContext: text,
            ebookPages: pages,
            fileData: null,
            content: pages[0] || '', 
            documentName: file.name,
            isEbookMode: true,
            isWebSearchMode: false,
            currentPage: 0,
            currentTopic: file.name,
            title: file.name,
            historyStack: [],
            isLoading: false
          });
      }

    } catch (err: unknown) {
      updateActiveTab({ 
          error: err instanceof Error ? err.message : "Error processing file.",
          isLoading: false
      });
    }
  }, [updateActiveTab]);

  const handleClearDocument = useCallback(() => {
    updateActiveTab({
        documentContext: null,
        documentName: null,
        fileData: null,
        isEbookMode: false,
        ebookPages: [],
        currentPage: 0,
        isWebSearchMode: false,
        currentTopic: 'Hypertext',
        title: 'Hypertext',
        historyStack: [],
        language: 'English' // Reset language on close
    });
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }, [updateActiveTab]);

  // Handle local eBook pagination with translation support
  const handlePrevPage = () => {
      const newPage = Math.max(activeTab.currentPage - 1, 0);
      const isTranslationNeeded = activeTab.language !== 'English';
      updateActiveTab({ 
          currentPage: newPage,
          // If translating, trigger loading state to force the translation hook
          isLoading: isTranslationNeeded,
          content: isTranslationNeeded ? '' : activeTab.ebookPages[newPage]
      });
  };

  const handleNextPage = () => {
      const newPage = Math.min(activeTab.currentPage + 1, activeTab.ebookPages.length - 1);
      const isTranslationNeeded = activeTab.language !== 'English';
      updateActiveTab({ 
          currentPage: newPage,
          isLoading: isTranslationNeeded,
          content: isTranslationNeeded ? '' : activeTab.ebookPages[newPage]
      });
  };
  
  const handlePrevWebSection = () => {
    const newIndex = Math.max(activeTab.webSectionIndex - 1, 0);
    updateActiveTab({ webSectionIndex: newIndex, isLoading: true, generatedDiagrams: {} });
  };
  
  const handleNextWebSection = () => {
    const newIndex = activeTab.webSectionIndex + 1;
    updateActiveTab({ webSectionIndex: newIndex, isLoading: true, generatedDiagrams: {} });
  };

  const displayTopic = (activeTab.isEbookMode && !activeTab.isWebSearchMode) ? (activeTab.documentName || activeTab.currentTopic) : activeTab.currentTopic;
  const isWebUrlMode = activeTab.webUrl !== null;

  return (
    <div>
      <TabBar 
        tabs={tabs.map(t => ({ id: t.id, title: t.title, isLoading: t.isLoading }))}
        activeTabId={activeTabId}
        onSwitchTab={handleTabSwitch}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
      />

      <SearchBar
        onSearch={handleSearch}
        onRandom={handleRandom}
        isLoading={activeTab.isLoading}
        onBack={handleBack}
        onForward={handleForward}
        canGoBack={activeTab.historyStack.length > 0}
        canGoForward={activeTab.futureStack.length > 0}
        onFileUpload={handleFileUpload}
        onClearDocument={handleClearDocument}
        documentName={activeTab.documentName}
        onViewDocument={() => setIsViewerOpen(true)}
        searchHistory={searchHistory}
        isWebSearchMode={activeTab.isWebSearchMode}
        onWebSearchModeChange={(isWeb) => updateActiveTab({ 
            isWebSearchMode: isWeb,
            isLoading: true, 
            content: '',     
            generatedDiagrams: {} 
        })}
        currentLanguage={activeTab.language}
        onLanguageChange={handleLanguageChange}
      />
      
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          {activeTab.isWebSearchMode && !activeTab.documentName ? 'WEB SEARCH' : 
           activeTab.fileData && activeTab.fileData.mimeType.startsWith('image/') ? 'IMAGE ANALYSIS' :
           activeTab.isEbookMode ? 'DOCUMENT READER' : 'INFINITE WIKI'}
        </h1>
      </header>

      <main>
        <div>
          <h2 style={{ marginBottom: '1rem', textTransform: 'capitalize' }}>
            {displayTopic} {activeTab.language !== 'English' && <span style={{fontSize: '0.6em', color: '#666'}}>({activeTab.language})</span>}
          </h2>

          {activeTab.fileData && activeTab.fileData.mimeType.startsWith('image/') && (
             <div className="diagram-container">
               <img 
                 src={`data:${activeTab.fileData.mimeType};base64,${activeTab.fileData.base64}`} 
                 alt="Uploaded content" 
                 className="diagram-image" 
                 style={{ maxHeight: '300px' }}
               />
             </div>
          )}
          
          {activeTab.isEbookMode && !activeTab.isWebSearchMode && !activeTab.fileData && activeTab.ebookPages.length > 1 && (
            <div className="pagination-controls">
              <button onClick={handlePrevPage} disabled={activeTab.isLoading || activeTab.currentPage === 0}>Previous</button>
              <span>Page {activeTab.currentPage + 1} of {activeTab.ebookPages.length}</span>
              <button onClick={handleNextPage} disabled={activeTab.isLoading || activeTab.currentPage >= activeTab.ebookPages.length - 1}>Next</button>
            </div>
          )}

          {activeTab.error && (
            <div style={{ border: '1px solid #cc0000', padding: '1rem', color: '#cc0000' }}>
              <p style={{ margin: 0 }}>An Error Occurred</p>
              <p style={{ marginTop: '0.5rem', margin: 0 }}>{activeTab.error}</p>
            </div>
          )}
          
          {activeTab.isLoading && activeTab.content.length === 0 && !activeTab.error && <LoadingSkeleton />}

          {activeTab.content.length > 0 && !activeTab.error && (
             <ContentDisplay 
               content={activeTab.content} 
               isLoading={activeTab.isLoading} 
               onWordClick={handleWordClick} 
               images={activeTab.generatedDiagrams}
             />
          )}

          {isWebUrlMode && !activeTab.isLoading && !activeTab.error && (
             <div className="pagination-controls" style={{ marginTop: '2rem' }}>
               <button onClick={handlePrevWebSection} disabled={activeTab.webSectionIndex === 0}>Previous Section</button>
               <span>Section {activeTab.webSectionIndex + 1}</span>
               <button onClick={handleNextWebSection}>Next Section (Load More)</button>
             </div>
          )}

          {!activeTab.isLoading && !activeTab.error && activeTab.content.length === 0 && (
            <div style={{ color: '#888', padding: '2rem 0' }}>
              <p>Content could not be generated or displayed.</p>
            </div>
          )}

          {activeTab.groundingSources.length > 0 && <GroundingSourcesDisplay sources={activeTab.groundingSources} />}
        </div>
      </main>

      <footer className="sticky-footer">
        <p className="footer-text" style={{ margin: 0 }}>
          Infinite Wiki by <a href="https://x.com/dev_valladares" target="_blank" rel="noopener noreferrer">Dev Valladares</a> · Generated by Gemini
          {activeTab.generationTime && ` · ${Math.round(activeTab.generationTime)}ms`}
        </p>
      </footer>
      
      {isViewerOpen && (
        <DocumentViewer
          content={activeTab.documentContext || (activeTab.fileData ? "Content format is binary/scanned. Please ask questions to explore it." : null)}
          documentName={activeTab.documentName}
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </div>
  );
};

export default App;