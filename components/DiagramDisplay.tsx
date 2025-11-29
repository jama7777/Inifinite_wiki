/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface DiagramDisplayProps {
  diagramData: string | null;
  isLoading: boolean; // Renamed to isDiagramLoading for clarity
  topic: string;
}

const DiagramDisplay: React.FC<DiagramDisplayProps> = ({ diagramData, isLoading: isDiagramLoading, topic }) => {
  // Show the skeleton only during the diagram-specific loading phase.
  const showSkeleton = isDiagramLoading;

  return (
    <div className="diagram-container">
      {showSkeleton && (
        <div className="diagram-skeleton" role="progressbar" aria-label="Loading diagram"></div>
      )}
      {diagramData && (
        <img
          src={`data:image/jpeg;base64,${diagramData}`}
          alt={`A diagram representing the concept of ${topic}`}
          className="diagram-image"
        />
      )}
    </div>
  );
};

export default DiagramDisplay;
