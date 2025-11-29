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
}

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
}) => {
  const [query, setQuery] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch(query.trim());
      setQuery(''); // Clear the input field after search
    }
  };

  const handleHistorySelect = (topic: string) => {
    onSearch(topic);
    setQuery(''); // Clear input
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
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setTimeout(() => setIsInputFocused(false), 200)} // Delay to allow clicks
            placeholder={placeholderText}
            className="search-input"
            aria-label="Search for a topic"
            disabled={isLoading}
            autoComplete="off"
          />
          {isInputFocused && searchHistory.length > 0 && !documentName && !isWebSearchMode && (
            <SearchHistoryDropdown history={searchHistory} onSelect={handleHistorySelect} />
          )}
        </form>
        <button onClick={onRandom} className="nav-button" disabled={isLoading || !!documentName}>
          Random
        </button>
      </div>
      <div className="document-controls">
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
              accept=".txt,.md,.pdf,.epub,.docx,.jpg,.jpeg,.png,.webp"
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