import React from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import ReportAnalyzer from './components/ReportAnalyzer';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <div className="App">
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/report-analyzer" element={<ReportAnalyzer />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
