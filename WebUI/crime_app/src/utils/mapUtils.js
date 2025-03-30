/**
 * Calculate the center point for a group of coordinates
 * @param {Array} points - Array of {lat, lng} objects
 * @returns {Object} - Center point {lat, lng}
 */
export const calculateCenter = (points) => {
  if (!points || points.length === 0) {
    return { lat: 37.7749, lng: -122.4194 }; // Default center (San Francisco)
  }
  
  const sumLat = points.reduce((sum, point) => sum + point.lat, 0);
  const sumLng = points.reduce((sum, point) => sum + point.lng, 0);
  
  return {
    lat: sumLat / points.length,
    lng: sumLng / points.length
  };
};

/**
 * Calculate appropriate zoom level based on the spread of points
 * @param {Array} points - Array of {lat, lng} objects
 * @returns {Number} - Zoom level (1-18)
 */
export const calculateZoomLevel = (points) => {
  if (!points || points.length <= 1) {
    return 11; // Default zoom
  }
  
  // Find min/max lat/lng
  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  
  // Calculate the spread
  const latSpread = maxLat - minLat;
  const lngSpread = maxLng - minLng;
  const maxSpread = Math.max(latSpread, lngSpread);
  
  // Convert spread to zoom level (approximate)
  if (maxSpread > 1) return 8;
  if (maxSpread > 0.5) return 9;
  if (maxSpread > 0.2) return 10;
  if (maxSpread > 0.1) return 11;
  if (maxSpread > 0.05) return 12;
  if (maxSpread > 0.02) return 13;
  if (maxSpread > 0.01) return 14;
  if (maxSpread > 0.005) return 15;
  
  return 16;
};

/**
 * Group nearby points to identify clusters/hotspots
 * @param {Array} points - Array of {lat, lng} objects
 * @param {Number} threshold - Distance threshold in degrees
 * @returns {Array} - Array of clusters, each with points and count
 */
export const identifyClusters = (points, threshold = 0.005) => {
  if (!points || points.length === 0) {
    return [];
  }
  
  const clusters = [];
  const processed = new Set();
  
  points.forEach((point, index) => {
    if (processed.has(index)) return;
    
    processed.add(index);
    const cluster = {
      points: [point],
      count: 1,
      center: { ...point }
    };
    
    // Find nearby points
    points.forEach((otherPoint, otherIndex) => {
      if (index === otherIndex || processed.has(otherIndex)) return;
      
      const distance = Math.sqrt(
        Math.pow(point.lat - otherPoint.lat, 2) + 
        Math.pow(point.lng - otherPoint.lng, 2)
      );
      
      if (distance <= threshold) {
        cluster.points.push(otherPoint);
        cluster.count++;
        processed.add(otherIndex);
      }
    });
    
    // Recalculate center for cluster
    if (cluster.count > 1) {
      cluster.center = calculateCenter(cluster.points);
    }
    
    clusters.push(cluster);
  });
  
  // Sort clusters by count (descending)
  return clusters.sort((a, b) => b.count - a.count);
}; 