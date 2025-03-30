import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Legend from './Legend';
import apiService,{API_BASE_URL} from '../services/apiService';

// Fix for the missing icons in leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Client-side clustering utility functions
const calculateDistance = (point1, point2) => {
  return Math.sqrt(
    Math.pow(point1.lat - point2.lat, 2) + 
    Math.pow(point1.lng - point2.lng, 2)
  );
};

const calculateCenter = (points) => {
  const count = points.length;
  let sumLat = 0, sumLng = 0;
  
  points.forEach(point => {
    sumLat += point.lat;
    sumLng += point.lng;
  });
  
  return {
    lat: sumLat / count,
    lng: sumLng / count
  };
};

// Function to perform client-side clustering
const clusterFeatures = (features, zoom) => {
  if (!features || features.length === 0) return [];
  
  // Skip clustering at high zoom levels
  if (zoom >= 15) return features.map(f => ({ ...f, properties: { ...f.properties, clustered: false } }));
  
  // Adjust clustering threshold based on zoom level
  // Lower zoom = larger clusters
  const threshold = Math.max(0.001, 0.01 / Math.pow(1.5, zoom - 10));
  
  const points = features.map(feature => ({
    feature,
    lat: feature.geometry.coordinates[1],
    lng: feature.geometry.coordinates[0],
    category: feature.properties.category
  }));
  
  const clusters = [];
  const processed = new Set();
  
  // Find clusters
  points.forEach((point, index) => {
    if (processed.has(index)) return;
    
    processed.add(index);
    const cluster = {
      points: [point],
      categories: { [point.category]: 1 },
      count: 1,
      center: { lat: point.lat, lng: point.lng }
    };
    
    // Find nearby points
    points.forEach((otherPoint, otherIndex) => {
      if (index === otherIndex || processed.has(otherIndex)) return;
      
      const distance = calculateDistance(point, otherPoint);
      
      if (distance <= threshold) {
        cluster.points.push(otherPoint);
        cluster.count++;
        
        // Track category counts
        if (!cluster.categories[otherPoint.category]) {
          cluster.categories[otherPoint.category] = 0;
        }
        cluster.categories[otherPoint.category]++;
        
        processed.add(otherIndex);
      }
    });
    
    // Recalculate center for cluster
    if (cluster.count > 1) {
      cluster.center = calculateCenter(cluster.points);
      
      // Find most common category
      let maxCount = 0;
      let dominantCategory = null;
      
      Object.entries(cluster.categories).forEach(([category, count]) => {
        if (count > maxCount) {
          maxCount = count;
          dominantCategory = category;
        }
      });
      
      // Create clustered GeoJSON feature
      clusters.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [cluster.center.lng, cluster.center.lat]
        },
        properties: {
          category: dominantCategory,
          count: cluster.count,
          clustered: true
        }
      });
    } else {
      // Single point, keep original feature but mark as not clustered
      clusters.push({
        ...point.feature,
        properties: {
          ...point.feature.properties,
          clustered: false
        }
      });
    }
  });
  
  return clusters;
};

// Custom ErrorBox component for better error handling
const ErrorBox = ({ message, onClose, onRetry }) => {
  return (
    <div className="custom-error-box">
      <div className="error-header">
        <span>Error</span>
        <button type="button" className="close-button" onClick={onClose}>&times;</button>
      </div>
      <div className="error-content">{message}</div>
      <button type="button" className="retry-button" onClick={onRetry}>
        Retry Connection
      </button>
    </div>
  );
};

const Map = ({ viewMode, categories, selectedCategories = [] }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayerRef = useRef(null);
  const heatLayerRef = useRef(null);
  const boundsRef = useRef(null);
  const errorControlRef = useRef(null);
  const selectedCategoriesRef = useRef(selectedCategories);
  const lastFetchRef = useRef(Date.now());
  const [mapInitialized, setMapInitialized] = useState(false);
  const [heatmapData, setHeatmapData] = useState([]);
  const [crimeFeatures, setCrimeFeatures] = useState([]);
  const [isHeatmapLoading, setIsHeatmapLoading] = useState(false);
  const [isCrimeDataLoading, setIsCrimeDataLoading] = useState(false);
  const [categoryColors, setCategoryColors] = useState({});
  const [apiError, setApiError] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const eventBindingsRef = useRef({
    moveend: false,
    zoomend: false
  });
  const [errorMessage, setErrorMessage] = useState('');

  // Update ref when selectedCategories changes
  useEffect(() => {
    selectedCategoriesRef.current = selectedCategories;
  }, [selectedCategories]);

  // Show or hide API error message - simplified version that sets state variables
  const showApiError = useCallback((show, message = 'Backend connection error. Please make sure the server is running.') => {
    if (show) {
      setApiError(true);
      setErrorMessage(message);
    } else {
      setApiError(false);
      setErrorMessage('');
    }
  }, []);

  // Rate limiter for API calls - prevent too many requests
  const shouldFetch = useCallback(() => {
    const now = Date.now();
    if (now - lastFetchRef.current < 250) { // 250ms throttle
      return false;
    }
    lastFetchRef.current = now;
    return true;
  }, []);

  // Generate consistent colors for categories
  const getCategoryColor = useCallback((category) => {
    const baseColors = [
      '#ff7800', // orange
      '#ff0000', // red
      '#0078ff', // blue
      '#7800ff', // purple
      '#00ff78', // green
      '#ff78ff', // pink
      '#787878', // gray
      '#00ffff', // cyan
      '#ffff00', // yellow
      '#ff7878'  // light red
    ];
    
    const newCategoryColors = {...categoryColors};
    
    if (!newCategoryColors[category]) {
      const index = Object.keys(newCategoryColors).length % baseColors.length;
      newCategoryColors[category] = baseColors[index];
      setCategoryColors(newCategoryColors);
    }
    
    return newCategoryColors[category] || '#ff0000'; // red as fallback
  }, [categoryColors]);

  // Update markers layer with clustered or individual markers based on current zoom level
  const updateMarkersLayer = useCallback((zoom) => {
    if (!mapInstance.current || !mapInitialized || !markersLayerRef.current || crimeFeatures.length === 0) return;
    
    try {
      // Clear existing markers
      markersLayerRef.current.clearLayers();
      
      // Apply client-side clustering based on current zoom level
      const displayFeatures = clusterFeatures(crimeFeatures, zoom);
      
      console.log(`Displaying ${displayFeatures.length} features (${displayFeatures.filter(f => f.properties.clustered).length} clusters)`);
      
      // Create markers for each feature
      displayFeatures.forEach(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
          const coords = feature.geometry.coordinates;
          const category = feature.properties.category;
          const isClustered = feature.properties.clustered;
          const count = feature.properties.count || 1;
          
          // Get color for this category
          const color = getCategoryColor(category);
          
          // Calculate size based on count for clusters
          const radius = isClustered ? Math.min(Math.max(8, Math.sqrt(count) * 2), 25) : 6;
          
          // Create marker
          const marker = L.circleMarker([coords[1], coords[0]], {
            radius: radius,
            fillColor: color,
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
          }).bindPopup(`
            <div>
              <h3>Crime Details</h3>
              <p><strong>Type:</strong> ${category}</p>
              ${feature.properties.date ? `<p><strong>Date:</strong> ${new Date(feature.properties.date).toLocaleDateString()}</p>` : ''}
              ${isClustered ? `<p><strong>Count:</strong> ${count} crimes in this area</p>` : ''}
              ${feature.properties.id ? `<p><strong>ID:</strong> ${feature.properties.id}</p>` : ''}
            </div>
          `);
          
          markersLayerRef.current.addLayer(marker);
        }
      });
    } catch (error) {
      console.error("Error updating markers layer:", error);
    }
  }, [crimeFeatures, getCategoryColor, mapInitialized]);

  // Fetch heatmap data from backend
  const fetchHeatmapData = useCallback(async () => {
    if (!mapInstance.current || !boundsRef.current || !shouldFetch() || !mapInitialized) return;
    
    setIsHeatmapLoading(true);
    try {
      const bounds = boundsRef.current;
      
      // Use relative URL for API access
      let url = `${API_BASE_URL}/heatmap?min_lng=${bounds.getWest()}&min_lat=${bounds.getSouth()}&max_lng=${bounds.getEast()}&max_lat=${bounds.getNorth()}`;
      
      // Add selectedCategories to the query if any are selected
      const currentCategories = selectedCategoriesRef.current;
      if (currentCategories && currentCategories.length > 0) {
        // Join categories with comma and encode for URL
        const categoriesParam = encodeURIComponent(currentCategories.join(','));
        url += `&categories=${categoriesParam}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Check if response is OK before parsing JSON
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Only update state if the map is still mounted and initialized
      if (mapInstance.current && mapInitialized) {
        // Hide error message if it was showing
        showApiError(false);
        
        setHeatmapData(data);
        console.log(`Loaded ${data.length} heatmap points`);
      }
    } catch (error) {
      console.error("Error fetching heatmap data:", error);
      if (mapInstance.current && mapInitialized) {
        setHeatmapData([]); // Empty array if fetch fails
        
        // Show error message
        showApiError(true, 'Backend connection error. Please make sure the server is running.');
      }
    } finally {
      setIsHeatmapLoading(false);
    }
  }, [showApiError, shouldFetch, mapInitialized]);

  // Fetch all crime data with no clustering from backend
  const fetchCrimeData = useCallback(async (zoom) => {
    if (!mapInstance.current || !boundsRef.current || !shouldFetch() || !mapInitialized) return;
    
    setIsCrimeDataLoading(true);
    try {
      const bounds = boundsRef.current;
      // Use higher zoom value to ensure no backend clustering
      const params = {
        min_lng: bounds.getWest(),
        min_lat: bounds.getSouth(),
        max_lng: bounds.getEast(),
        max_lat: bounds.getNorth(),
        zoom: 16 // Always request individual points (no backend clustering)
      };
      
      console.log(`Fetching crime data for bounds, actual zoom level: ${zoom}`);
      
      // Use relative URL for API access
      let url = `${API_BASE_URL}/crimes?min_lng=${params.min_lng}&min_lat=${params.min_lat}&max_lng=${params.max_lng}&max_lat=${params.max_lat}&zoom=${params.zoom}`;
      
      // Add selectedCategories to the query if any are selected
      const currentCategories = selectedCategoriesRef.current;
      if (currentCategories && currentCategories.length > 0) {
        // Join categories with comma and encode for URL
        const categoriesParam = encodeURIComponent(currentCategories.join(','));
        url += `&categories=${categoriesParam}`;
      }
      
      // Get the data from backend
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Parse the response
      const data = await response.json();
      
      // Check if the response contains an error field (from Flask)
      if (data.error) {
        throw new Error(`Backend error: ${data.error}`);
      }
      
      // Even if status is 500, if we get a parseable JSON response with features, try to use it
      if (data && data.type === 'FeatureCollection') {
        // Only update if the map is still mounted and initialized
        if (mapInstance.current && mapInitialized && markersLayerRef.current) {
          // Hide error message if it was showing
          showApiError(false);
          
          if (data.features && data.features.length > 0) {
            console.log(`Received ${data.features.length} individual crime points from backend`);
            
            // Store the raw crime features
            setCrimeFeatures(data.features);
            
            // Update the markers layer with clustered or individual data
            updateMarkersLayer(zoom);
          } else {
            console.log("No crime data found in the current view");
            setCrimeFeatures([]);
            markersLayerRef.current.clearLayers();
          }
        }
      } else {
        // If we got a response but it's not valid GeoJSON, throw an error
        throw new Error("Invalid response format from backend");
      }
    } catch (error) {
      console.error("Error fetching crime data:", error);
      
      if (mapInstance.current && mapInitialized) {
        // Show a more helpful error message
        let errorMessage = 'Backend connection error. Please make sure the server is running.';
        if (error.message.includes('Backend error')) {
          // If it's a backend error, show that specific message
          errorMessage = error.message;
        }
        
        // Show error message
        showApiError(true, errorMessage);
        
        // Even when the backend fails, use any existing data we have
        if (crimeFeatures.length > 0) {
          updateMarkersLayer(zoom || mapInstance.current.getZoom());
        }
      }
    } finally {
      setIsCrimeDataLoading(false);
    }
  }, [getCategoryColor, showApiError, shouldFetch, mapInitialized, crimeFeatures.length, updateMarkersLayer]);

  // Bind map event handlers safely
  const bindMapEvents = useCallback(() => {
    if (!mapInstance.current || !mapInitialized) return;
    
    try {
      // Unbind any existing handlers first to prevent duplicates
      if (eventBindingsRef.current.moveend) {
        mapInstance.current.off('moveend', handleMapChange);
      }
      if (eventBindingsRef.current.zoomend) {
        mapInstance.current.off('zoomend', handleMapChange);
      }
      
      // Bind new handlers
      mapInstance.current.on('moveend', handleMapChange);
      mapInstance.current.on('zoomend', handleMapChange);
      
      // Update binding status
      eventBindingsRef.current.moveend = true;
      eventBindingsRef.current.zoomend = true;
      
      console.log("Map event handlers bound successfully");
    } catch (error) {
      console.error("Error binding map events:", error);
    }
  }, [mapInitialized]); // handleMapChange will be added in after it's defined

  // Handle map change (pan/zoom)
  const handleMapChange = useCallback(() => {
    if (!mapInstance.current || !mapInitialized) return;
    
    try {
      // Store current bounds for API requests
      boundsRef.current = mapInstance.current.getBounds();
      const zoom = mapInstance.current.getZoom();
      
      // Log the current zoom level for debugging
      console.log(`Map zoom changed to: ${zoom}`);
      
      // If there's an API error, don't try to fetch new data
      if (apiError) return;
      
      // If we've panned outside the current bounds, reload crime data
      if ((viewMode === 'markers' || viewMode === 'both') && !isCrimeDataLoading) {
        fetchCrimeData(zoom);
      } else if ((viewMode === 'markers' || viewMode === 'both') && !isCrimeDataLoading) {
        // If we've just zoomed but still have data, update clustering
        updateMarkersLayer(zoom);
      }
      
      // If we're showing heatmap data, update it based on the new bounds
      if ((viewMode === 'heatmap' || viewMode === 'both') && !isHeatmapLoading) {
        fetchHeatmapData();
      }
    } catch (error) {
      console.error("Error handling map change:", error);
    }
  }, [viewMode, isHeatmapLoading, isCrimeDataLoading, fetchCrimeData, fetchHeatmapData, apiError, mapInitialized, updateMarkersLayer]);

  // Add handleMapChange dependency after its definition
  useEffect(() => {
    bindMapEvents();
  }, [bindMapEvents, handleMapChange]);

  // Initialize map
  useEffect(() => {
    // Clean up any existing map instance first
    if (mapInstance.current) {
      try {
        if (eventBindingsRef.current.moveend) {
          mapInstance.current.off('moveend', handleMapChange);
        }
        if (eventBindingsRef.current.zoomend) {
          mapInstance.current.off('zoomend', handleMapChange);
        }
        mapInstance.current.remove();
      } catch (error) {
        console.error("Error cleaning up map:", error);
      }
      mapInstance.current = null;
      setMapInitialized(false);
      eventBindingsRef.current = { moveend: false, zoomend: false };
    }
    
    // Only create the map if it doesn't exist already
    if (!mapInstance.current && mapRef.current) {
      try {
        // Create map instance with error handling
        mapInstance.current = L.map(mapRef.current, {
          zoomControl: true,
          doubleClickZoom: true,
          boxZoom: true,
          keyboard: true,
          scrollWheelZoom: true,
          dragging: true,
          zoomAnimation: true
        }).setView([37.7749, -122.4194], 12);
        
        // Add tile layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstance.current);
        
        // Create layers for markers
        markersLayerRef.current = L.layerGroup().addTo(mapInstance.current);
        
        // Flag map as initialized
        setMapInitialized(true);
        
        // Try to load Leaflet.heat for heatmap if not already available
        if (!L.heatLayer && typeof window !== 'undefined') {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
          script.async = true;
          document.body.appendChild(script);
        }
        
        console.log("Map initialized successfully");
        
        // Let React finish rendering before binding events or fetching data
        setTimeout(() => {
          boundsRef.current = mapInstance.current.getBounds();
          const currentZoom = mapInstance.current.getZoom();
          fetchCrimeData(currentZoom);
          setIsFirstLoad(false);
        }, 1000);
      } catch (error) {
        console.error("Error initializing map:", error);
        mapInstance.current = null;
      }
    }
    
    // Cleanup function
    return () => {
      try {
        if (mapInstance.current) {
          if (eventBindingsRef.current.moveend) {
            mapInstance.current.off('moveend', handleMapChange);
          }
          if (eventBindingsRef.current.zoomend) {
            mapInstance.current.off('zoomend', handleMapChange);
          }
          mapInstance.current.remove();
          mapInstance.current = null;
          setMapInitialized(false);
          eventBindingsRef.current = { moveend: false, zoomend: false };
        }
      } catch (error) {
        console.error("Error in map cleanup:", error);
      }
    };
  }, []); // Empty dependency array to run only once
  
  // Update when selectedCategories change - but don't refetch on first render
  useEffect(() => {
    if (!mapInstance.current || !mapInitialized || isFirstLoad) return;
    
    console.log("Selected categories changed:", selectedCategories);
    
    // If there's an API error, don't try to fetch new data
    if (apiError) return;
    
    // Add a slight delay to prevent frequent refetching
    const timer = setTimeout(() => {
      try {
        // Fetch data with current map parameters when categories change
        const currentZoom = mapInstance.current.getZoom();
        fetchCrimeData(currentZoom);
        
        if (viewMode === 'heatmap' || viewMode === 'both') {
          fetchHeatmapData();
        }
      } catch (error) {
        console.error("Error updating data after category change:", error);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [selectedCategories, viewMode, fetchCrimeData, fetchHeatmapData, apiError, isFirstLoad, mapInitialized]);
  
  // Update when viewMode changes
  useEffect(() => {
    if (!mapInstance.current || !mapInitialized || isFirstLoad) return;
    
    // If there's an API error, don't try to fetch new data
    if (apiError) return;
    
    try {
      // If we need heatmap data, fetch it
      if ((viewMode === 'heatmap' || viewMode === 'both') && heatmapData.length === 0) {
        fetchHeatmapData();
      }
      
      // If we need to update markers with new clustering due to view mode change
      if ((viewMode === 'markers' || viewMode === 'both') && !isCrimeDataLoading && crimeFeatures.length > 0) {
        const currentZoom = mapInstance.current.getZoom();
        updateMarkersLayer(currentZoom);
      }
    } catch (error) {
      console.error("Error updating view mode:", error);
    }
  }, [viewMode, heatmapData.length, fetchHeatmapData, apiError, isFirstLoad, mapInitialized, crimeFeatures.length, updateMarkersLayer, isCrimeDataLoading]);
  
  // Update heatmap when heatmap data or view mode changes
  useEffect(() => {
    if (!mapInstance.current || !mapInitialized) return;
    
    try {
      // Remove existing heatmap layer
      if (heatLayerRef.current && mapInstance.current.hasLayer(heatLayerRef.current)) {
        mapInstance.current.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      
      // If view mode includes heatmap and we have data
      if ((viewMode === 'heatmap' || viewMode === 'both') && heatmapData.length > 0) {
        // Check if Leaflet.heat is loaded
        if (typeof L.heatLayer === 'function') {
          // Create heatmap layer
          heatLayerRef.current = L.heatLayer(heatmapData, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            gradient: {0.4: 'blue', 0.65: 'lime', 1: 'red'}
          }).addTo(mapInstance.current);
        } else {
          // Fallback if Leaflet.heat is not available
          console.warn("Leaflet.heat not loaded. Using fallback visualization.");
          
          // Use a simplified visualization with circles
          heatLayerRef.current = L.layerGroup().addTo(mapInstance.current);
          
          // Group points by grid cells
          const gridSize = 0.005;
          const heatGrid = {};
          
          heatmapData.forEach(point => {
            const lat = point[0];
            const lng = point[1];
            const gridX = Math.floor(lat / gridSize) * gridSize;
            const gridY = Math.floor(lng / gridSize) * gridSize;
            const key = `${gridX}-${gridY}`;
            
            if (!heatGrid[key]) {
              heatGrid[key] = {
                lat: gridX + gridSize/2,
                lng: gridY + gridSize/2,
                count: 0
              };
            }
            
            heatGrid[key].count++;
          });
          
          // Create circles with opacity based on count
          Object.values(heatGrid).forEach(cell => {
            const radius = Math.min(100, Math.max(30, cell.count * 20));
            const opacity = Math.min(0.8, Math.max(0.2, cell.count * 0.15));
            
            const circle = L.circle([cell.lat, cell.lng], {
              radius,
              color: 'red',
              fillColor: '#f03',
              fillOpacity: opacity,
              weight: 0
            });
            
            heatLayerRef.current.addLayer(circle);
          });
        }
      }
    } catch (error) {
      console.error("Error updating heatmap:", error);
    }
  }, [viewMode, heatmapData, mapInitialized]);

  return (
    <div className="map-container">
      <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} className="map"></div>
      <Legend categoryColors={categoryColors} />
      
      {/* Error message overlay */}
      {apiError && (
        <ErrorBox
          message={errorMessage}
          onClose={() => showApiError(false)}
          onRetry={() => {
            showApiError(false);
            if (mapInstance.current) {
              const zoom = mapInstance.current.getZoom();
              if (viewMode === 'markers' || viewMode === 'both') {
                fetchCrimeData(zoom);
              }
              if (viewMode === 'heatmap' || viewMode === 'both') {
                fetchHeatmapData();
              }
            }
          }}
        />
      )}
    </div>
  );
};

export default Map; 