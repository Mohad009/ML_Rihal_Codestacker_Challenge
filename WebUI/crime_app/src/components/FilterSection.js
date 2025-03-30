import React, { useState, useEffect } from 'react';

const FilterSection = ({ categories, onCategoryChange, viewMode, onViewModeChange, loading }) => {
  const [selectedCategories, setSelectedCategories] = useState([]);

  const handleCategoryToggle = (category) => {
    const newSelectedCategories = selectedCategories.includes(category)
      ? selectedCategories.filter(c => c !== category)
      : [...selectedCategories, category];
    
    setSelectedCategories(newSelectedCategories);
  };

  useEffect(() => {
    onCategoryChange(selectedCategories);
  }, [selectedCategories, onCategoryChange]);

  const handleViewModeChange = (e) => {
    onViewModeChange(e.target.value);
  };

  const handleSelectAll = () => {
    setSelectedCategories([...categories]);
  };

  const handleClearAll = () => {
    setSelectedCategories([]);
  };

  return (
    <div className="filter-section">
      <h2>Filters</h2>
      
      <div className="view-mode-filter">
        <h3>View Mode</h3>
        <select 
          value={viewMode} 
          onChange={handleViewModeChange}
          disabled={loading}
        >
          <option value="markers">Markers Only</option>
          <option value="heatmap">Heatmap Only</option>
          <option value="both">Both</option>
        </select>
      </div>
      
      <div className="category-filter">
        <h3>Crime Categories</h3>
        <div className="category-actions">
          <button onClick={handleSelectAll} disabled={loading}>Select All</button>
          <button onClick={handleClearAll} disabled={loading}>Clear All</button>
        </div>
        
        <div className="category-list">
          {categories.length > 0 ? (
            categories.map(category => (
              <div key={category} className="category-item">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category)}
                    onChange={() => handleCategoryToggle(category)}
                    disabled={loading}
                  />
                  {category}
                </label>
              </div>
            ))
          ) : (
            <div className="loading-categories">
              {loading ? 'Loading categories...' : 'No categories available'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterSection; 