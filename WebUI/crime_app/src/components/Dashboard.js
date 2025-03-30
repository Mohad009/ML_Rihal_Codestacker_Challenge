import React, { useState, useEffect } from 'react';
import Map from './Map';
import Sidebar from './Sidebar';
import '../styles/index.css';
import apiService from '../services/apiService';

const Dashboard = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('both'); // 'markers', 'heatmap', 'both'
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalCrimes: 0,
    categoryCounts: {},
    mostCommonType: ''
  });

  // Load categories and stats on component mount
  useEffect(() => {
    checkServerAvailability();
    fetchCategories();
    fetchStats();
  }, []);

  // Check if backend server is available
  const checkServerAvailability = async () => {
    try {
      const isAvailable = await apiService.checkHealth();
      if (!isAvailable) {
        setError('Backend server is not available. Please run "python backend.py" to start the Flask server.');
      } else {
        setError('');
      }
    } catch (err) {
      setError('Backend server is not available. Please run "python backend.py" to start the Flask server.');
    }
  };

  // Fetch categories from the backend
  const fetchCategories = async () => {
    try {
      const categoriesData = await apiService.getCategories();
      if (Array.isArray(categoriesData)) {
        // Extract just the category names for our component
        const categoryNames = categoriesData.map(cat => 
          typeof cat === 'object' ? cat.name : cat
        );
        setCategories(categoryNames);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      // Empty categories as fallback
      setCategories([]);
    }
  };

  // Fetch stats from the backend
  const fetchStats = async () => {
    try {
      const statsData = await apiService.getStats();
      
      // Convert backend stats format to our format
      const categoryCounts = {};
      if (statsData.top_categories) {
        statsData.top_categories.forEach(cat => {
          categoryCounts[cat.name] = cat.count;
        });
      }
      
      setStats({
        totalCrimes: statsData.total_crimes || 0,
        categoryCounts,
        mostCommonType: statsData.top_categories && statsData.top_categories.length > 0 
          ? statsData.top_categories[0].name
          : '',
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleCategoryChange = (categories) => {
    setSelectedCategories(categories);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  // Retry connecting to the server
  const handleRetryConnection = async () => {
    setLoading(true);
    await checkServerAvailability();
    await fetchCategories();
    await fetchStats();
    setLoading(false);
  };

  return (
    <div className="dashboard">
      {error && (
        <div className="server-error-message">
          <p>{error}</p>
          <button onClick={handleRetryConnection} disabled={loading}>
            {loading ? 'Trying...' : 'Retry Connection'}
          </button>
        </div>
      )}
      <Sidebar 
        onCategoryChange={handleCategoryChange}
        onViewModeChange={handleViewModeChange}
        stats={stats}
        viewMode={viewMode}
        categories={categories}
        loading={loading}
      />
      <Map 
        viewMode={viewMode}
        categories={categories}
        selectedCategories={selectedCategories}
      />
    </div>
  );
};

export default Dashboard; 