/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface GroundingSourcesDisplayProps {
  sources: any[];
}

const GroundingSourcesDisplay: React.FC<GroundingSourcesDisplayProps> = ({ sources }) => {
  const validSources = sources.filter(source => source.web && source.web.uri && source.web.title);

  if (validSources.length === 0) {
    return null;
  }

  return (
    <div className="grounding-sources-container">
      <h3>Sources</h3>
      <ol className="sources-list">
        {validSources.map((source, index) => (
          <li key={index} className="source-item">
            <a href={source.web.uri} target="_blank" rel="noopener noreferrer">
              {source.web.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default GroundingSourcesDisplay;
