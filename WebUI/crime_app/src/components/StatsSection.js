import React from 'react';

const StatsSection = ({ stats, loading }) => {
  const { totalCrimes, categoryCounts, mostCommonType } = stats;

  if (loading) {
    return (
      <div className="stats-section">
        <h2>Crime Statistics</h2>
        <div className="loading-stats">Loading statistics...</div>
      </div>
    );
  }

  return (
    <div className="stats-section">
      <h2>Crime Statistics</h2>
      
      <div className="stat-item">
        <h3>Total Crimes</h3>
        <div className="stat-value">{totalCrimes}</div>
      </div>
      
      {mostCommonType && (
        <div className="stat-item">
          <h3>Most Common Crime</h3>
          <div className="stat-value">{mostCommonType}</div>
        </div>
      )}
      
      <div className="stat-item">
        <h3>Crimes by Category</h3>
        <div className="stat-categories">
          {Object.keys(categoryCounts).length > 0 ? (
            Object.entries(categoryCounts).map(([category, count]) => (
              <div key={category} className="stat-category">
                <span>{category}:</span>
                <span>{count}</span>
              </div>
            ))
          ) : (
            <div className="no-data">No category data available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsSection; 