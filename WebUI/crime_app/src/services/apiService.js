import axios from 'axios';

// Use relative URL - will work in all environments with nginx
export const API_BASE_URL = 'http://localhost:5000/api';

// Track API availability to avoid repeated error messages
let apiAvailable = true;
let lastErrorTime = 0;
const ERROR_COOLDOWN = 10000; // 10 seconds between error logs

const apiService = {
  /**
   * Upload crime data (PDF) to the server
   * @param {File} file - PDF file containing crime data
   * @returns {Promise} - Promise with the upload result
   */
  uploadCrimeData: async (file) => {
    try {
      if (!apiAvailable && Date.now() - lastErrorTime < ERROR_COOLDOWN) {
        throw new Error('Server unavailable. Please check if the backend server is running.');
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json'
        }
      });
      
      apiAvailable = true;
      return response.data;
    } catch (error) {
      handleApiError('Error uploading crime data:', error);
      throw error;
    }
  },
  
  /**
   * Get crime data from the server
   * @param {Object} params - Query parameters for filtering crimes
   * @returns {Promise} - Promise with GeoJSON crime data
   */
  getCrimeData: async (params = {}) => {
    try {
      if (!apiAvailable && Date.now() - lastErrorTime < ERROR_COOLDOWN) {
        throw new Error('Server unavailable. Please check if the backend server is running.');
      }
      
      const response = await axios.get(`${API_BASE_URL}/crimes`, { params });
      apiAvailable = true;
      return response.data;
    } catch (error) {
      handleApiError('Error fetching crime data:', error);
      
      // Return empty GeoJSON as fallback
      return {
        type: 'FeatureCollection',
        features: []
      };
    }
  },
  
  /**
   * Get heatmap data from the server
   * @param {Object} params - Query parameters for filtering heatmap data
   * @returns {Promise} - Promise with heatmap data points
   */
  getHeatmapData: async (params = {}) => {
    try {
      if (!apiAvailable && Date.now() - lastErrorTime < ERROR_COOLDOWN) {
        throw new Error('Server unavailable. Please check if the backend server is running.');
      }
      
      const response = await axios.get(`${API_BASE_URL}/heatmap`, { params });
      apiAvailable = true;
      return response.data;
    } catch (error) {
      handleApiError('Error fetching heatmap data:', error);
      return [];
    }
  },
  
  /**
   * Get crime categories from the server
   * @returns {Promise} - Promise with categories array
   */
  getCategories: async () => {
    try {
      if (!apiAvailable && Date.now() - lastErrorTime < ERROR_COOLDOWN) {
        throw new Error('Server unavailable. Please check if the backend server is running.');
      }
      
      const response = await axios.get(`${API_BASE_URL}/categories`);
      apiAvailable = true;
      return response.data;
    } catch (error) {
      handleApiError('Error fetching categories:', error);
      return [];
    }
  },
  
  /**
   * Get crime statistics from the server
   * @returns {Promise} - Promise with the crime statistics
   */
  getStats: async () => {
    try {
      if (!apiAvailable && Date.now() - lastErrorTime < ERROR_COOLDOWN) {
        throw new Error('Server unavailable. Please check if the backend server is running.');
      }
      
      const response = await axios.get(`${API_BASE_URL}/stats`);
      apiAvailable = true;
      return response.data;
    } catch (error) {
      handleApiError('Error fetching statistics:', error);
      return {
        total_crimes: 0,
        top_categories: []
      };
    }
  },
  
  /**
   * Check if the backend API is available and responsive
   * @returns {Promise<boolean>} - Promise with health status
   */
  checkHealth: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
      apiAvailable = true;
      return response.data.status === 'ok';
    } catch (error) {
      console.error('API health check failed:', error);
      apiAvailable = false;
      lastErrorTime = Date.now();
      return false;
    }
  },
  
  /**
   * Extract data from a PDF report using the server-side extraction
   * @param {File} file - PDF file to extract data from
   * @returns {Promise} - Promise with the extracted data
   */
  extractReportData: async (file) => {
    try {
      if (!apiAvailable && Date.now() - lastErrorTime < ERROR_COOLDOWN) {
        throw new Error('Server unavailable. Please check if the backend server is running.');
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API_BASE_URL}/extract-report`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json'
        }
      });
      
      apiAvailable = true;
      return response.data;
    } catch (error) {
      handleApiError('Error extracting report data:', error);
      throw error;
    }
  },

  // Predict category based on description
  predictCategory: async (description) => {
    try {
      if (!apiAvailable && Date.now() - lastErrorTime < ERROR_COOLDOWN) {
        throw new Error('Server unavailable. Please check if the backend server is running.');
      }
      
      const response = await axios.post(`${API_BASE_URL}/predict-category`, { description });
      
      apiAvailable = true;
      return response.data;
    } catch (error) {
      handleApiError('Error predicting category:', error);
      if (error.response && error.response.data) {
        throw new Error(error.response.data.error || 'Failed to predict category');
      }
      throw new Error(error.message || 'Failed to connect to prediction service');
    }
  },

};

/**
 * Helper function to handle API errors consistently
 */
function handleApiError(message, error) {
  // Only log errors with full details if we haven't logged recently
  if (Date.now() - lastErrorTime > ERROR_COOLDOWN) {
    console.error(message, error);
    
    // Check for connection refused
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.warn('Backend server appears to be offline. Please make sure the Flask server is running.');
      apiAvailable = false;
    }
    
    lastErrorTime = Date.now();
  }
}

export default apiService; 