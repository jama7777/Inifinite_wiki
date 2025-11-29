/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface SearchHistoryDropdownProps {
  history: string[];
  onSelect: (topic: string) => void;
}

const SearchHistoryDropdown: React.FC<SearchHistoryDropdownProps> = ({ history, onSelect }) => {
  return (
    <ul className="search-history-dropdown">
      {history.map((topic, index) => (
        <li key={index} className="search-history-item">
          <button onClick={() => onSelect(topic)}>
            {topic}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default SearchHistoryDropdown;
