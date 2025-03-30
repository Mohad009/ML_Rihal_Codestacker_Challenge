import React, { useState, useRef } from 'react';
import '../styles/ReportAnalyzer.css';
import apiService from '../services/apiService';

import { Link } from 'react-router-dom';

const ReportAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setFileName(selectedFile.name);
        setError('');
        // Clear the previous extracted data and validation message when a new file is selected
        setExtractedData(null);
        setValidationMessage('');
      } else {
        setError('Please upload a PDF file');
        setFile(null);
        setFileName('');
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleExtract = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError('');
    setValidationMessage(''); // Clear any previous validation messages

    try {
      // Send the PDF file to the server for extraction
      const extractedData = await apiService.extractReportData(file);
      
      // Set the extracted data in the state
      setExtractedData({
        coordinates: extractedData.coordinates || { latitude: '', longitude: '' },
        description: extractedData.description || ''
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Error extracting data:', error);
      
      // Display the error message from the server if available
      if (error.response && error.response.data && error.response.data.error) {
        setError(error.response.data.error);
      } else {
        setError(error.message || 'Failed to extract data from the report');
      }
      
      setLoading(false);
      setExtractedData(null); // Don't show form if extraction fails
    }
  };

  const handleDataChange = (field, value) => {
    if (field.includes('.')) {
      const [parentField, childField] = field.split('.');
      setExtractedData({
        ...extractedData,
        [parentField]: {
          ...extractedData[parentField],
          [childField]: value
        }
      });
    } else {
      setExtractedData({
        ...extractedData,
        [field]: value
      });
    }
  };

  const handleClear = () => {
    setFile(null);
    setFileName('');
    setExtractedData(null); // This clears all extracted data including predictions
    setError('');
    setValidationMessage(''); // Also clear any validation messages
  };

  const handleValidateData = async () => {
    // Only proceed if we have extracted data with a description
    if (!extractedData || !extractedData.description) {
      setError('No description to validate. Please extract data first.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Call the prediction API endpoint
      const response = await apiService.predictCategory(extractedData.description);
      
      // Show the predicted category
      if (response.success) {
        setExtractedData({
          ...extractedData,
          predictedCategory: response.category
        });
        
        // Don't set validation message to avoid duplication
        setValidationMessage('');
      } else {
        setError(response.error || 'Failed to predict category');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error validating data:', error);
      setError(error.message || 'Failed to validate data');
      setLoading(false);
    }
  };

  return (
    <div className="report-analyzer-container">
      <div className="analyzer-header">
        <div className="analyzer-header-content">
          <h1>PDF Coordinate Extractor</h1>
          <p className="analyzer-subtitle">
            Extract coordinates and detailed description from PDF reports
          </p>
        </div>
        <Link to="/" className="back-to-dashboard">
          <span className="back-icon">←</span> Back to Dashboard
        </Link>
      </div>

      <div className="report-analyzer">
        <div className="upload-card">
          <h2 className="section-title">Upload PDF Report</h2>
          <p className="section-description">
            Upload a PDF police report to automatically extract coordinates and description
          </p>

          <div className="upload-section">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf"
              style={{ display: 'none' }}
            />
            <button 
              onClick={handleUploadClick} 
              className="upload-button"
              disabled={loading}
            >
              Choose File
            </button>
            {fileName && <span className="file-name">{fileName}</span>}
            <button 
              onClick={handleExtract} 
              className="extract-button"
              disabled={!file || loading}
            >
              {loading ? 'Extracting...' : 'Extract Data'}
            </button>
            <button 
              onClick={handleClear} 
              className="clear-button"
              disabled={loading || (!file && !extractedData)}
            >
              Clear
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        {extractedData && (
          <div className="extracted-data">
            <h2 className="section-title">Extracted Location Data</h2>
            <p className="help-text">Review and edit the extracted coordinates and description</p>
            
            <div className="data-table">
              <div className="data-row">
                <div className="data-label">Coordinates</div>
                <div className="data-value coordinates-input">
                  <div className="coordinate-field">
                    <label>Latitude:</label>
                    <input 
                      type="text" 
                      value={extractedData.coordinates.latitude} 
                      onChange={(e) => handleDataChange('coordinates.latitude', e.target.value)}
                      placeholder="Latitude (e.g., 23.12897)"
                    />
                  </div>
                  <div style={{ width: '20px' }}></div>
                  <div className="coordinate-field">
                    <label>Longitude:</label>
                    <input 
                      type="text" 
                      value={extractedData.coordinates.longitude} 
                      onChange={(e) => handleDataChange('coordinates.longitude', e.target.value)}
                      placeholder="Longitude (e.g., -82.38481)"
                    />
                  </div>
                </div>
              </div>

              <div className="data-row">
                <div className="data-label">Detailed Description</div>
                <div className="data-value">
                  <textarea 
                    value={extractedData.description} 
                    onChange={(e) => handleDataChange('description', e.target.value)}
                    rows={8}
                    placeholder="Detailed description of the incident..."
                  />
                </div>
              </div>

              {extractedData.predictedCategory && (
                <div className="data-row">
                  <div className="data-label">Predicted Category</div>
                  <div className="data-value prediction-result">
                    <span className="category-tag">{extractedData.predictedCategory}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="action-buttons">
              <button 
                className="validate-button" 
                onClick={handleValidateData}
                disabled={loading || !extractedData.description}
              >
                {loading ? 'Processing...' : 'Validate Data'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportAnalyzer; 