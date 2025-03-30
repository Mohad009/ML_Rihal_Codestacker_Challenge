import React, { useState } from 'react';
import '../styles/Legend.css';

const Legend = ({ categoryColors }) => {
  const [isVisible, setIsVisible] = useState(true);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  return (
    <div className={`legend-container ${isVisible ? 'visible' : 'collapsed'}`}>
      <div className="legend-header">
        <h3>Crime Categories</h3>
        <button 
          className="legend-toggle-btn" 
          onClick={toggleVisibility}
          aria-label={isVisible ? "Hide legend" : "Show legend"}
        >
          {isVisible ? "−" : "+"}
        </button>
      </div>

      {isVisible && (
        <div className="legend-content">
          {Object.entries(categoryColors).map(([category, color]) => (
            <div key={category} className="legend-item">
              <div className="color-box" style={{ backgroundColor: color }}></div>
              <span className="category-name">{category}</span>
            </div>
          ))}
          {Object.keys(categoryColors).length === 0 && (
            <div className="legend-empty">No data available</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Legend; 