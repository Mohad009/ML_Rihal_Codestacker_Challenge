import React from 'react';
import FilterSection from './FilterSection';
import StatsSection from './StatsSection';
import { Link } from 'react-router-dom';

const Sidebar = ({ 
  onCategoryChange, 
  onViewModeChange, 
  stats, 
  viewMode, 
  categories,
  loading
}) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>Crime Analysis</h1>
        <p className="sidebar-subtitle">Interactive Data Visualization Platform</p>
        
        <div className="sidebar-nav">
          <Link to="/report-analyzer" className="sidebar-nav-link">
            <span className="sidebar-nav-icon">📄</span>
            Report Analyzer
          </Link>
        </div>
      </div>
      
      <FilterSection 
        categories={categories}
        onCategoryChange={onCategoryChange}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        loading={loading}
      />
      
      <StatsSection 
        stats={stats} 
        loading={loading}
      />
    </div>
  );
};

export default Sidebar; 