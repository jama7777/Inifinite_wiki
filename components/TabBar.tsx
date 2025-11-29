/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

export interface TabData {
  id: string;
  title: string;
  isLoading: boolean;
}

interface TabBarProps {
  tabs: TabData[];
  activeTabId: string;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, activeTabId, onSwitchTab, onCloseTab, onNewTab }) => {
  return (
    <div className="tab-bar">
      <div className="tabs-list">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => onSwitchTab(tab.id)}
            role="tab"
            aria-selected={tab.id === activeTabId}
            title={tab.title}
          >
            <span className="tab-title">
              {tab.isLoading ? 'Loading...' : (tab.title || 'New Tab')}
            </span>
            <button
              className="tab-close-button"
              onClick={(e) => {
                e.stopPropagation(); // Prevent switching when closing
                onCloseTab(tab.id);
              }}
              aria-label="Close tab"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      <button className="new-tab-button" onClick={onNewTab} aria-label="Open new tab">
        +
      </button>
    </div>
  );
};

export default TabBar;