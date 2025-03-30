import pickle
import os
import logging
from typing import Dict, Any, Optional
import joblib
import traceback

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CrimeCategoryPredictor:
    def __init__(self, model_path: str = "crime_category_prediction_model.pkl"):
        """Initialize the crime category predictor with the specified model file."""
        self.model_path = model_path
        self.model = None
        self.loader_used = None
        self.load_model()
    
    def load_model(self) -> None:
        """Load the model from disk trying different methods."""
        if not os.path.exists(self.model_path):
            logger.error(f"Model file not found: {self.model_path}")
            raise FileNotFoundError(f"Model file not found: {self.model_path}")
        
        logger.info(f"Attempting to load model from {self.model_path}")
        
        # Try different loading methods
        loading_methods = [
            ('pickle', self._load_with_pickle),
            ('joblib', self._load_with_joblib),
            # Add more loading methods if needed
        ]
        
        last_exception = None
        for method_name, loader_method in loading_methods:
            try:
                logger.info(f"Trying to load model with {method_name}")
                self.model = loader_method()
                self.loader_used = method_name
                logger.info(f"Successfully loaded model using {method_name}")
                return
            except Exception as e:
                logger.warning(f"Failed to load model with {method_name}: {str(e)}")
                last_exception = e
        
        # If we reach here, all loading methods failed
        logger.error(f"Failed to load model with all methods. Last error: {str(last_exception)}")
        logger.error(f"Model file details - Size: {os.path.getsize(self.model_path)} bytes, Path: {os.path.abspath(self.model_path)}")
        
        # Print first few bytes of the file to diagnose format
        try:
            with open(self.model_path, 'rb') as f:
                file_header = f.read(50)
                logger.info(f"File header (first 50 bytes): {file_header}")
        except Exception as header_e:
            logger.error(f"Could not read file header: {str(header_e)}")
        
        raise RuntimeError(f"Failed to load model: {str(last_exception)}")
    
    def _load_with_pickle(self):
        """Load model using pickle."""
        with open(self.model_path, 'rb') as f:
            return pickle.load(f)
    
    def _load_with_joblib(self):
        """Load model using joblib."""
        return joblib.load(self.model_path)
    
    def predict_category(self, description: str) -> Dict[str, Any]:
        """
        Predict crime category based on the description.
        
        Args:
            description: The crime description text
            
        Returns:
            A dictionary containing the predicted category and confidence score
        """
        if not self.model:
            logger.error("Model not loaded")
            return {"error": "Model not loaded", "category": None, "confidence": 0}
        
        if not description or not isinstance(description, str):
            logger.warning("Invalid description provided")
            return {"error": "Invalid description", "category": None, "confidence": 0}
        
        try:
            logger.info(f"Making prediction for text: '{description[:100]}...' (truncated)")
            
            # Different models might have different prediction interfaces
            # Try various common prediction methods
            prediction = None
            confidence = 0.0
            
            # Method 1: Standard scikit-learn style prediction
            try:
                prediction = self.model.predict([description])[0]
                logger.info(f"Prediction successful: {prediction}")
                
                # Try to get prediction probability if available
                try:
                    proba = self.model.predict_proba([description])
                    confidence = float(proba.max())
                    logger.info(f"Got confidence score: {confidence}")
                except (AttributeError, ValueError) as prob_err:
                    logger.warning(f"Could not get probability: {str(prob_err)}")
                    confidence = 1.0  # Default confidence
            
            except Exception as predict_err:
                logger.warning(f"Standard prediction failed: {str(predict_err)}")
                
                # Method 2: Try direct callable model (like some TensorFlow/PyTorch models)
                try:
                    result = self.model(description)
                    if hasattr(result, 'argmax'):
                        prediction = str(result.argmax())
                    elif isinstance(result, (list, tuple)) and len(result) > 0:
                        prediction = str(result[0])
                    else:
                        prediction = str(result)
                    confidence = 0.9  # Default confidence for this method
                    logger.info(f"Direct prediction successful: {prediction}")
                except Exception as direct_err:
                    logger.warning(f"Direct prediction failed: {str(direct_err)}")
            
            if prediction is None:
                raise ValueError("All prediction methods failed")
            
            return {
                "category": str(prediction),  # Convert to string to ensure serializable
                "confidence": float(confidence)  # Convert to float to ensure serializable
            }
            
        except Exception as e:
            logger.error(f"Error during prediction: {str(e)}")
            logger.error(traceback.format_exc())
            return {"error": str(e), "category": None, "confidence": 0}

# Singleton instance for reuse
_predictor_instance = None

def get_predictor(model_path: str = "crime_category_prediction_model.pkl") -> CrimeCategoryPredictor:
    """Get or create the predictor singleton."""
    global _predictor_instance
    if _predictor_instance is None:
        try:
            _predictor_instance = CrimeCategoryPredictor(model_path)
        except Exception as init_error:
            logger.error(f"Failed to initialize predictor: {init_error}")
            # We'll create a dummy predictor that always returns an error
            # Store the error message to avoid scoping issues
            error_message = str(init_error)
            
            class DummyPredictor:
                def __init__(self, error_msg):
                    self.error_msg = error_msg
                    
                def predict_category(self, description: str) -> Dict[str, Any]:
                    return {"error": f"Model could not be loaded: {self.error_msg}", "category": None, "confidence": 0}
            
            _predictor_instance = DummyPredictor(error_message)
    return _predictor_instance