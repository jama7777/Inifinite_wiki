/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import SearchHistoryDropdown from './SearchHistoryDropdown';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onRandom: () => void;
  isLoading: boolean;
  onBack: () => void;
  onForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onFileUpload: (file: File) => void;
  onClearDocument: () => void;
  onViewDocument: () => void;
  documentName: string | null;
  searchHistory: string[];
  isWebSearchMode: boolean;
  onWebSearchModeChange: (isWebSearch: boolean) => void;
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
}

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Chinese (Simplified)',
  'Japanese',
  'Hindi',
  'Arabic',
  'Portuguese',
  'Russian'
];

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  onRandom,
  isLoading,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  onFileUpload,
  onClearDocument,
  onViewDocument,
  documentName,
  searchHistory,
  isWebSearchMode,
  onWebSearchModeChange,
  currentLanguage,
  onLanguageChange
}) => {
  const [query, setQuery] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch(query.trim());
      setQuery(''); // Clear the input field after search
      setIsInputFocused(false); // Close dropdown
    }
  };

  const handleHistorySelect = (topic: string) => {
    onSearch(topic);
    setQuery(''); // Clear input
    setIsInputFocused(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onFileUpload(event.target.files[0]);
    }
  };
  
  const handleToggleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onWebSearchModeChange(event.target.checked);
  };

  const placeholderText = isWebSearchMode 
    ? documentName
      ? 'Ask a question about your file...'
      : "Ask a question..."
    : documentName 
    ? 'Search inside file...' 
    : 'Search topic, Paste YouTube link, or eBook URL...';

  return (
    <div className="search-container">
      <div className="search-controls">
        <div className="nav-group">
          <button 
            onClick={onBack} 
            className="nav-button nav-arrow" 
            disabled={isLoading || !canGoBack}
            aria-label="Go Back"
          >
            ←
          </button>
          <button 
            onClick={onForward} 
            className="nav-button nav-arrow" 
            disabled={isLoading || !canGoForward}
            aria-label="Go Forward"
          >
            →
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="search-form" role="search">
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              // Increased delay and added check to allow click propagation on history items
              onBlur={() => setTimeout(() => setIsInputFocused(false), 300)}
              placeholder={placeholderText}
              className="search-input"
              aria-label="Search for a topic"
              disabled={isLoading}
              autoComplete="off"
            />
            <button 
              type="submit" 
              className="search-submit-button" 
              disabled={isLoading || !query.trim()}
              aria-label="Submit Search"
            >
              GO
            </button>
          </div>
          {isInputFocused && searchHistory.length > 0 && !documentName && !isWebSearchMode && (
            <div onMouseDown={(e) => e.preventDefault()}> {/* Prevent blur on mousedown */}
              <SearchHistoryDropdown history={searchHistory} onSelect={handleHistorySelect} />
            </div>
          )}
        </form>
        <button onClick={onRandom} className="nav-button" disabled={isLoading || !!documentName}>
          Random
        </button>
      </div>
      <div className="document-controls">
        <select 
          value={currentLanguage} 
          onChange={(e) => onLanguageChange(e.target.value)}
          className="language-selector"
          disabled={isLoading}
          style={{ 
            border: 'none', 
            background: 'transparent', 
            font: 'inherit', 
            color: '#555', 
            cursor: 'pointer',
            paddingRight: '1rem'
          }}
        >
          {LANGUAGES.map(lang => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>

        <label className="ai-search-toggle">
          Web Search
          <div className="toggle-switch">
            <input type="checkbox" checked={isWebSearchMode} onChange={handleToggleChange} disabled={isLoading} />
            <span className="toggle-slider"></span>
          </div>
        </label>
        
        {!isWebSearchMode && (
          <>
            <input
              type="file"
              id="file-upload"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              // Allow all files to let the app attempt to handle them (either via text extraction or multimodal fallback)
              accept="*" 
              disabled={isLoading}
            />
            <label htmlFor="file-upload" className={`nav-button ${isLoading ? 'disabled' : ''}`}>
              Upload
            </label>
            {documentName && (
              <>
                <span className="document-name" title={documentName}>
                  {documentName}
                </span>
                <button
                  onClick={onViewDocument}
                  className="nav-button"
                  disabled={isLoading}
                  aria-label="View loaded document"
                >
                  View
                </button>
                <button
                  onClick={onClearDocument}
                  className="clear-button"
                  disabled={isLoading}
                  aria-label="Clear loaded document"
                >
                  &times;
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SearchBar;