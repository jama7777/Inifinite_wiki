/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface ContentDisplayProps {
  content: string;
  isLoading: boolean;
  onWordClick?: (word: string) => void;
  images?: Record<string, string>; // prompt -> base64
}

const InteractiveContent: React.FC<{
  content: string;
  onWordClick?: (word: string) => void;
  images?: Record<string, string>;
}> = ({ content, onWordClick, images }) => {
  // Split content by Diagram tags
  // Tag format: [DIAGRAM: description]
  const parts = content.split(/(\[DIAGRAM:\s*.*?\])/g);

  return (
    <>
      {parts.map((part, index) => {
        const diagramMatch = part.match(/^\[DIAGRAM:\s*(.*?)\]$/);
        
        if (diagramMatch) {
          const prompt = diagramMatch[1];
          const imageBase64 = images?.[prompt];
          
          if (imageBase64) {
            return (
              <div key={index} className="diagram-container" style={{ margin: '2rem 0' }}>
                <img 
                  src={`data:image/png;base64,${imageBase64}`} 
                  alt={`Generated Diagram: ${prompt}`} 
                  className="diagram-image" 
                />
                <p style={{ fontSize: '0.8em', color: '#666', textAlign: 'center' }}>Figure: {prompt}</p>
              </div>
            );
          } else {
             return (
               <div key={index} style={{ padding: '1rem', backgroundColor: '#f9f9f9', border: '1px dashed #ccc', margin: '1rem 0', fontSize: '0.9em', color: '#666' }}>
                  Generating visual for: {prompt}...
               </div>
             );
          }
        }

        // Standard Text Rendering
        const words = part.split(/(\s+)/).filter(Boolean);
        return (
          <p key={index} style={{ margin: '0 0 1rem 0', display: 'inline' }}>
            {words.map((word, wIndex) => {
              if (/\S/.test(word) && onWordClick) {
                const cleanWord = word.replace(/[.,!?;:()"']/g, '');
                if (cleanWord) {
                  return (
                    <button
                      key={wIndex}
                      onClick={() => onWordClick(cleanWord)}
                      className="interactive-word"
                      aria-label={`Learn more about ${cleanWord}`}
                    >
                      {word}
                    </button>
                  );
                }
              }
              return <span key={wIndex}>{word}</span>;
            })}
          </p>
        );
      })}
    </>
  );
};

const StreamingContent: React.FC<{ content: string }> = ({ content }) => (
  <p style={{ margin: 0 }}>
    {content}
    <span className="blinking-cursor">|</span>
  </p>
);

const ContentDisplay: React.FC<ContentDisplayProps> = ({ content, isLoading, onWordClick, images }) => {
  if (isLoading) {
    return <StreamingContent content={content} />;
  }
  
  if (content) {
    return <InteractiveContent content={content} onWordClick={onWordClick} images={images} />;
  }

  return null;
};

export default ContentDisplay;