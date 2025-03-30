from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from geoalchemy2 import Geometry
from geoalchemy2.functions import ST_AsGeoJSON
import json
from sqlalchemy import func
from flask_caching import Cache
import os
import tempfile
import logging
from flask_cors import CORS
from datetime import datetime
import re
import fitz  # PyMuPDF
from model_service import get_predictor
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
# Enable CORS for all routes to allow the React frontend to access the API
CORS(app, resources={f"{os.getenv('API_PREFIX')}/*": {"origins": os.getenv('CORS_ORIGINS')}})

# Configure database connection
app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Configure caching
cache = Cache(app, config={
    'CACHE_TYPE': os.getenv('CACHE_TYPE'),
    'CACHE_DEFAULT_TIMEOUT': int(os.getenv('CACHE_DEFAULT_TIMEOUT'))
})

# Initialize SQLAlchemy
db = SQLAlchemy(app)

# File upload configurations
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER')
app.config['PROCESSED_FOLDER'] = os.getenv('PROCESSED_FOLDER')
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_CONTENT_LENGTH'))

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL')),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ensure required directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)

# Define Crime model
class Crime(db.Model):
    __tablename__ = 'crimes_data'
    
    id = db.Column(db.Integer, primary_key=True)
    incident_number = db.Column(db.String(100), unique=True, nullable=False)
    category = db.Column(db.String(100), nullable=False)
    date = db.Column(db.DateTime, nullable=False)
    location = db.Column(db.String(500))
    description = db.Column(db.Text)
    geometry = db.Column(Geometry('POINT', srid=4326), nullable=False)
    predicted_category = db.Column(db.String(100))
    predicted_severity = db.Column(db.String(50))
    category_confidence = db.Column(db.Float)
    severity_confidence = db.Column(db.Float)

    def __repr__(self):
        return f'<Crime {self.incident_number}>'

# routes
@app.route(f"{os.getenv('API_PREFIX')}/crimes", methods=['GET'])
def get_crimes():
    try:
        # Get query parameters for filtering
        categories_param = request.args.get('categories')
        categories = categories_param.split(',') if categories_param else []
        
        # Get bounding box parameters
        min_lng = request.args.get('min_lng')
        min_lat = request.args.get('min_lat')
        max_lng = request.args.get('max_lng')
        max_lat = request.args.get('max_lat')
        
        # Get zoom level for clustering decision
        zoom = int(request.args.get('zoom', 12))
        logger.info(f"Current zoom level: {zoom}")
        
        # Create cache key based on parameters
        cache_key = f"crimes_{min_lng}_{min_lat}_{max_lng}_{max_lat}_{categories_param}_{zoom}"
        cached_result = cache.get(cache_key)
        
        if cached_result:
            return jsonify(cached_result)
        
        # Start building query 
        if zoom >= 15:
            # For zoomed in views, show individual points with optimized query
            try:
                query = db.session.query(
                    Crime.id, 
                    Crime.category,
                    Crime.date,
                    func.ST_AsGeoJSON(Crime.geometry).label('geojson')
                )
            except Exception as e:
                logger.error(f"Error building query: {e}")
                # If date is causing issues, try without it
                query = db.session.query(
                    Crime.id, 
                    Crime.category,
                    func.ST_AsGeoJSON(Crime.geometry).label('geojson')
                )
            
            # Apply category filter if provided
            if categories:
                query = query.filter(Crime.category.in_(categories))
            
            # Apply bounding box filter if all coordinates provided
            if all([min_lng, min_lat, max_lng, max_lat]):
                bbox = f'POLYGON(({min_lng} {min_lat}, {max_lng} {min_lat}, {max_lng} {max_lat}, {min_lng} {max_lat}, {min_lng} {min_lat}))'
                query = query.filter(
                    func.ST_Within(
                        Crime.geometry,
                        func.ST_GeomFromText(bbox, 4326)
                    )
                )
            
            query = query.limit(10000)
            
            # Execute query
            results = query.all()
            
            # Format as GeoJSON
            features = []
            for crime in results:
                try:
                    geom = json.loads(crime.geojson)
                    # Format date as ISO string for JS compatibility
                    date_str = None
                    try:
                        date_str = crime.date.isoformat() if hasattr(crime, 'date') and crime.date else None
                    except (AttributeError, TypeError) as e:
                        logger.error(f"Error formatting date: {e}")
                        date_str = None
                    
                    features.append({
                        'type': 'Feature',
                        'geometry': geom,
                        'properties': {
                            'id': crime.id,
                            'category': crime.category,
                            'date': date_str,
                            'clustered': False
                        }
                    })
                except Exception as e:
                    logger.error(f"Error processing crime {crime.id}: {e}")
        else:
            # For zoomed out views, use server-side clustering
            cluster_factor = max(0.001, 0.05 / (2 ** (zoom - 10))) if zoom > 10 else 0.05
            logger.info(f"Using cluster factor: {cluster_factor}")
            
            # ST_SnapToGrid for clustering points
            query = db.session.query(
                func.ST_AsGeoJSON(func.ST_Centroid(func.ST_Collect(Crime.geometry))).label('geojson'),
                Crime.category,
                func.count(Crime.id).label('count')
            )
            
            # Apply category filter if provided
            if categories:
                query = query.filter(Crime.category.in_(categories))
            
            # Apply bounding box filter if all coordinates provided
            if all([min_lng, min_lat, max_lng, max_lat]):
                bbox = f'POLYGON(({min_lng} {min_lat}, {max_lng} {min_lat}, {max_lng} {max_lat}, {min_lng} {max_lat}, {min_lng} {min_lat}))'
                query = query.filter(
                    func.ST_Within(
                        Crime.geometry,
                        func.ST_GeomFromText(bbox, 4326)
                    )
                )
            
            # Group by grid cell and category
            query = query.group_by(
                func.ST_SnapToGrid(Crime.geometry, cluster_factor, cluster_factor),
                Crime.category
            )
            
            # Execute query
            results = query.all()
            
            # Format as GeoJSON
            features = []
            for result in results:
                try:
                    geom = json.loads(result.geojson)
                    features.append({
                        'type': 'Feature',
                        'geometry': geom,
                        'properties': {
                            'category': result.category,
                            'count': result.count,
                            'clustered': True
                        }
                    })
                except Exception as e:
                    logger.error(f"Error processing cluster: {e}")
        
        # Create GeoJSON FeatureCollection
        result = {
            'type': 'FeatureCollection',
            'features': features
        }
        
        # Cache the result
        cache.set(cache_key, result)
        
        # Return GeoJSON FeatureCollection
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in get_crimes: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'type': 'FeatureCollection',
            'features': []
        }), 500

# route for crime categories
@app.route(f"{os.getenv('API_PREFIX')}/categories", methods=['GET'])
@cache.cached(timeout=int(os.getenv('CATEGORIES_CACHE_TIMEOUT', 3600)))
def get_categories():
    try:
        # Query distinct categories with counts
        category_counts = db.session.query(
            Crime.category, 
            func.count(Crime.id).label('count')
        ).group_by(Crime.category).order_by(func.count(Crime.id).desc()).all()
        
        # Format response with counts
        categories = [{'name': cat[0], 'count': cat[1]} for cat in category_counts if cat[0]]
        
        return jsonify(categories)
    except Exception as e:
        logger.error(f"Error in get_categories: {e}")
        return jsonify([]), 500

# route for heatmap data
@app.route(f"{os.getenv('API_PREFIX')}/heatmap", methods=['GET'])
def get_heatmap_data():
    try:
        # Get query parameters for filtering
        categories_param = request.args.get('categories')
        categories = categories_param.split(',') if categories_param else []
        
        # Get bounding box parameters
        min_lng = request.args.get('min_lng')
        min_lat = request.args.get('min_lat')
        max_lng = request.args.get('max_lng')
        max_lat = request.args.get('max_lat')
        
        # Create cache key
        cache_key = f"heatmap_{min_lng}_{min_lat}_{max_lng}_{max_lat}_{categories_param}"
        cached_result = cache.get(cache_key)
        
        if cached_result:
            return jsonify(cached_result)
        
        # Build a simpler query for heatmap points to avoid potential errors
        query = db.session.query(
            Crime.geometry
        )
        
        # Apply category filter if provided
        if categories:
            query = query.filter(Crime.category.in_(categories))
        
        # Apply bounding box filter if all coordinates provided
        if all([min_lng, min_lat, max_lng, max_lat]):
            try:
                bbox = f'POLYGON(({min_lng} {min_lat}, {max_lng} {min_lat}, {max_lng} {max_lat}, {min_lng} {max_lat}, {min_lng} {min_lat}))'
                query = query.filter(
                    func.ST_Within(
                        Crime.geometry,
                        func.ST_GeomFromText(bbox, 4326)
                    )
                )
            except Exception as e:
                logger.error(f"Error creating bounding box: {e}")
                # Continue without the bounding box filter
        
        # Limit the number of points to prevent browser overload
        query = query.limit(10000)
        
        # Execute query
        results = query.all()
        
        # Format for heatmap - Leaflet.heat expects [lat, lng, intensity]
        heatmap_data = []
        for point in results:
            try:
                # Extract coordinates from WKB geometry
                point_geojson = db.session.scalar(func.ST_AsGeoJSON(point.geometry))
                point_obj = json.loads(point_geojson)
                
                # GeoJSON coordinates are [longitude, latitude]
                lng = point_obj['coordinates'][0]
                lat = point_obj['coordinates'][1]
                
                # Add to heatmap data with default intensity of 1
                heatmap_data.append([lat, lng, 1])
            except Exception as e:
                logger.error(f"Error processing heatmap point: {e}")
                continue
        
        logger.info(f"Generated {len(heatmap_data)} heatmap points")
        
        # Cache the result
        cache.set(cache_key, heatmap_data)
        
        return jsonify(heatmap_data)
    except Exception as e:
        import traceback
        logger.error(f"Error in get_heatmap_data: {e}")
        logger.error(traceback.format_exc())
        return jsonify([]), 500

@app.route(f"{os.getenv('API_PREFIX')}/stats", methods=['GET'])
@cache.cached(timeout=int(os.getenv('STATS_CACHE_TIMEOUT', 3600)))
def get_stats():
    try:
        # Get total count - no limits here
        total_count = db.session.query(func.count(Crime.id)).scalar()
        
        # Get top categories - no limits to show all categories
        top_categories = db.session.query(
            Crime.category,
            func.count(Crime.id).label('count')
        ).group_by(Crime.category).order_by(func.count(Crime.id).desc()).all()
        
        # Return all categories instead of just top 5
        return jsonify({
            'total_crimes': total_count,
            'top_categories': [{'name': cat[0], 'count': cat[1]} for cat in top_categories if cat[0]]
        })
    except Exception as e:
        logger.error(f"Error in get_stats: {e}")
        return jsonify({'error': str(e)}), 500

# Add health check endpoint
@app.route(f"{os.getenv('API_PREFIX')}/health", methods=['GET'])
def health_check():
    try:
        # Check database connection
        db_check = db.session.query(func.count(Crime.id)).limit(1).scalar() is not None
        return jsonify({
            'status': 'ok',
            'database': 'connected' if db_check else 'disconnected',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route(f"{os.getenv('API_PREFIX')}/extract-report", methods=['POST'])
def extract_report_data():
    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        # Check if file was selected
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Check file type
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': 'File must be a PDF'}), 400
        
        # Use Python's tempfile module to create a temporary file
        temp_fd, temp_path = tempfile.mkstemp(suffix='.pdf')
        os.close(temp_fd)  # Close the file descriptor
        
        logger.info(f"Saving uploaded file to temporary location: {temp_path}")
        
        # Save the file to the temporary location
        try:
            file.save(temp_path)
            logger.info(f"Successfully saved file to: {temp_path}")
        except Exception as e:
            logger.error(f"Failed to save file: {e}")
            return jsonify({'error': f'Could not save uploaded file: {str(e)}'}), 500
        
        logger.info(f"Processing PDF report: {file.filename}")
        
        try:
            # Extract text using PyMuPDF
            doc = fitz.open(temp_path)
            text = ""
            
            # Extract text from all pages
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text += page.get_text()
            
            # Store original text for special extraction cases
            original_text = text
            
            # Normalize text - replace multiple spaces, normalize line breaks
            text = re.sub(r'\s+', ' ', text)  # Replace multiple spaces with a single space
            text = re.sub(r'(\n\s*)+', '\n\n', text)  # Normalize line breaks
            
            logger.info(f"Extracted {len(text)} characters of text from PDF")
            
            # Extract coordinates using improved regex patterns
            coord_patterns = [
                # Format: Coordinates: (37.78091651016261, -122.404100362918)
                r'coordinates:?\s*\(?([\d\.\-]+)[,\s]+([\d\.\-]+)\)?',
                # Format: GPS: 37.78091651016261, -122.404100362918
                r'GPS:?\s*\(?([\d\.\-]+)[,\s]+([\d\.\-]+)\)?',
                # Format: latitude: 37.78091651016261, longitude: -122.404100362918
                r'lat[itude]?[,:]?\s*([\d\.\-]+)[,\s]+long[itude]?[,:]?\s*([\d\.\-]+)',
                # Format: location: lat 37.78091651016261, long -122.404100362918
                r'location:?\s*\(?lat[itude]?:?\s*([\d\.\-]+)[,\s]+(?:long[itude]?:?)?\s*([\d\.\-]+)\)?',
            ]
            
            latitude = None
            longitude = None
            
            for pattern in coord_patterns:
                coord_match = re.search(pattern, text, re.IGNORECASE)
                if coord_match:
                    latitude = coord_match.group(1)
                    longitude = coord_match.group(2)
                    logger.info(f"Found coordinates: {latitude}, {longitude} using pattern: {pattern}")
                    break
            
            # Extract detailed description sections with improved patterns for handling indented multiline descriptions
            description = ""
            
            # First try to match descriptions with the specific format mentioned in the example
            # Format: Detail Description: Evading a politc officer recklessly. hight speed suspect escaping.
            detail_desc_match = re.search(r'(?:detail(?:ed)?\s+description)[:.]?\s*(.*?)(?=\s*(?:police district:|location:|coordinates:|date:|time:|incident type:|reporting officer:|case number:)|$)', 
                                        original_text, re.IGNORECASE | re.DOTALL)
            
            if detail_desc_match:
                # Extract the description and handle indentation
                raw_desc = detail_desc_match.group(1).strip()
                # Replace line breaks followed by spaces (indentation) with a single space
                description = re.sub(r'\n\s+', ' ', raw_desc)
                # Clean up multiple spaces
                description = re.sub(r'\s+', ' ', description)
                logger.info(f"Found detailed description with specific format, length: {len(description)}")
            
            # If not found, try other patterns
            if not description:
                desc_patterns = [
                    # Format: Detailed Description: Petty theft from locked auto...
                    r'(?:detailed\s+description|description)[:.]?\s*(.*?)(?=\s*(?:police district:|location:|coordinates:|date:|time:|incident type:|reporting officer:|case number:)|\Z)',
                    # Format: Incident Description: Petty theft...
                    r'(?:incident|crime)\s+description[:.]?\s*(.*?)(?=\s*(?:police district:|location:|coordinates:|date:|time:|incident type:|reporting officer:|case number:)|\Z)',
                    # Format: Narrative: Petty theft...
                    r'narrative[:.]?\s*(.*?)(?=\s*(?:police district:|location:|coordinates:|date:|time:|incident type:|reporting officer:|case number:)|\Z)',
                    # Format: Summary: Petty theft...
                    r'summary[:.]?\s*(.*?)(?=\s*(?:police district:|location:|coordinates:|date:|time:|incident type:|reporting officer:|case number:)|\Z)',
                ]
                
                for pattern in desc_patterns:
                    desc_match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
                    if desc_match:
                        description = desc_match.group(1).strip()
                        # Clean up the description - replace line breaks with spaces, remove multiple spaces
                        description = re.sub(r'\s*\n\s*', ' ', description)
                        description = re.sub(r'\s+', ' ', description)
                        logger.info(f"Found description of length {len(description)} using pattern: {pattern}")
                        break
            
            # If no description was found using patterns, try to find the longest paragraph
            if not description:
                logger.info("No description found with patterns, searching for longest paragraph")
                # Try different paragraph splitting strategies
                potential_paragraphs = []
                
                # Strategy 1: Split by double newlines
                paragraphs1 = re.split(r'\n\n+', text)
                potential_paragraphs.extend([p.strip() for p in paragraphs1 if len(p.strip()) > 100])
                
                # Strategy 2: Look for paragraphs with crime-related keywords
                crime_keywords = ['theft', 'robbery', 'burglary', 'assault', 'stolen', 'suspect', 'victim', 'incident', 'crime', 'police', 'evading', 'officer']
                for p in potential_paragraphs:
                    if any(keyword in p.lower() for keyword in crime_keywords):
                        # This paragraph has crime-related keywords - prioritize it
                        description = p
                        logger.info(f"Found paragraph with crime keywords: {description[:50]}...")
                        break
                
                # If still no description, just use the longest paragraph
                if not description and potential_paragraphs:
                    description = max(potential_paragraphs, key=len)
                    logger.info(f"Using longest paragraph of length {len(description)}")
                
                # Clean up the description
                if description:
                    description = re.sub(r'\s*\n\s*', ' ', description)
                    description = re.sub(r'\s+', ' ', description)
            
            # Additional post-processing to remove unwanted text
            if description:
                # Common section headers that shouldn't be part of description
                section_headers = [
                    'police district', 'location', 'coordinates', 'date', 'time', 
                    'incident type', 'reporting officer', 'case number', 'officer', 
                    'incident number', 'status', 'classification'
                ]
                
                # Look for any of these section headers in the description and cut before them
                for header in section_headers:
                    # Find full form of header (e.g., "Police District:")
                    header_match = re.search(fr'(?i)[^.]*?\b{re.escape(header)}\b[^.]*?(:|\.).*$', description)
                    if header_match:
                        # Cut the description before this header
                        cut_point = header_match.start()
                        logger.info(f"Trimming description at section header: {header} (at position {cut_point})")
                        description = description[:cut_point].strip()
                
                # Find sentences that appear to be ending the descriptive content
                end_markers = ['. Police', '. Location', '. Date', '. Time', '. Reporting']
                for marker in end_markers:
                    if marker.lower() in description.lower():
                        end_idx = description.lower().find(marker.lower()) + 1  # +1 to include the period
                        description = description[:end_idx].strip()
                        logger.info(f"Trimmed description at marker: {marker}")
                        break
            
            # Close the document
            doc.close()
            
            # If no data was extracted, return an error
            if not latitude and not longitude and not description:
                logger.warning(f"No data extracted from PDF")
                return jsonify({
                    'error': 'Could not extract coordinates or description from the PDF. Please ensure the PDF contains the required information.'
                }), 400
            
            # Prepare extracted data
            extracted_data = {
                "coordinates": {
                    "latitude": latitude or "",
                    "longitude": longitude or ""
                },
                "description": description or ""
            }
            
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            return jsonify({'error': f'Error extracting data from PDF: {str(e)}'}), 500
        finally:
            # Clean up temporary file in finally block to ensure it happens
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                    logger.info(f"Removed temporary file: {temp_path}")
            except Exception as e:
                logger.warning(f"Could not remove temporary file {temp_path}: {e}")
        
        return jsonify(extracted_data)
        
    except Exception as e:
        logger.error(f"Error processing report: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route(f"{os.getenv('API_PREFIX')}/predict-category", methods=['POST'])
def predict_category():
    try:
        # Check if request contains the required data
        if not request.json or 'description' not in request.json:
            return jsonify({'error': 'No description provided', 'success': False}), 400
        
        description = request.json.get('description', '')
        
        # Validate description
        if not description or not isinstance(description, str):
            return jsonify({'error': 'Invalid description format', 'success': False}), 400
        
        logger.info(f"Predicting category for description (length: {len(description)})")
        
        # Get predictor and make prediction
        try:
            # Add some debug information about model file
            model_path = os.getenv('MODEL_PATH', '/app/crime_category_prediction_model.pkl')
            model_exists = os.path.exists(model_path)
            if model_exists:
                model_size = os.path.getsize(model_path)
                model_abs_path = os.path.abspath(model_path)
                logger.info(f"Model file details - Exists: {model_exists}, Size: {model_size} bytes, Path: {model_abs_path}")
            else:
                logger.error(f"Model file does not exist at path: {os.path.abspath(model_path)}")
                return jsonify({
                    'error': f'Model file not found at {os.path.abspath(model_path)}',
                    'success': False
                }), 500
            
            predictor = get_predictor(model_path)
            result = predictor.predict_category(description)
            
            # Check if prediction was successful
            if 'error' in result and result.get('category') is None:
                logger.error(f"Prediction failed: {result.get('error')}")
                return jsonify({
                    'error': f"Prediction failed: {result.get('error')}",
                    'success': False
                }), 500
            
            # Return prediction result
            logger.info(f"Prediction successful: {result.get('category')} with confidence {result.get('confidence')}")
            return jsonify({
                'success': True,
                'category': result.get('category'),
                'confidence': result.get('confidence')
            })
        except Exception as e:
            logger.error(f"Error in prediction process: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return jsonify({
                'error': f'Prediction failed: {str(e)}',
                'success': False
            }), 500
            
    except Exception as e:
        logger.error(f"Error processing prediction request: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'success': False}), 500

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        debug=os.getenv('DEBUG').lower() in ('true', '1', 't'),
        port=int(os.getenv('PORT'))
    )