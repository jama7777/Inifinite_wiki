/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface DocumentViewerProps {
  content: string | null;
  documentName: string | null;
  onClose: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ content, documentName, onClose }) => {
  if (!content) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2 className="modal-title">{documentName || 'Document Viewer'}</h2>
          <button onClick={onClose} className="modal-close-button" aria-label="Close document viewer">&times;</button>
        </header>
        <div className="modal-body">
          {content}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;