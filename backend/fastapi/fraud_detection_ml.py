"""
Advanced ML-based Fraud Detection for Invoice AI
Uses Random Forest and ensemble methods for anomaly detection
"""
import os
import logging
import pickle
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
import numpy as np
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

logger = logging.getLogger(__name__)


class FraudDetectionML:
    """
    Machine learning-based fraud detection for invoices
    """

    # Risk score thresholds
    RISK_THRESHOLDS = {
        'low': 0.3,
        'medium': 0.6,
        'high': 0.8
    }

    # Feature importance weights
    FEATURE_WEIGHTS = {
        'amount_anomaly': 0.25,
        'vendor_anomaly': 0.20,
        'date_anomaly': 0.15,
        'duplicate_score': 0.20,
        'pattern_anomaly': 0.20
    }

    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize ML fraud detection

        Args:
            model_path: Path to saved model file
        """
        self.model_path = model_path or os.path.join(
            os.path.dirname(__file__),
            'models',
            'fraud_detection_model.pkl'
        )

        self.rf_classifier = None
        self.isolation_forest = None
        self.scaler = StandardScaler()
        self.is_trained = False

        # Load model if exists
        if os.path.exists(self.model_path):
            self.load_model()

        logger.info('Fraud detection ML initialized')

    def extract_features(self, invoice: Dict[str, Any],
                        historical_data: List[Dict[str, Any]]) -> np.ndarray:
        """
        Extract features from invoice for ML model

        Args:
            invoice: Current invoice data
            historical_data: Historical invoices for comparison

        Returns:
            Feature vector as numpy array
        """
        features = []

        # 1. Amount-based features
        amount = float(invoice.get('total_amount', 0))
        features.append(amount)

        # Historical amount stats
        if historical_data:
            amounts = [float(inv.get('total_amount', 0)) for inv in historical_data]
            features.append(np.mean(amounts))  # Mean amount
            features.append(np.std(amounts))   # Std deviation
            features.append(np.median(amounts))  # Median amount

            # Z-score (how many std devs from mean)
            if np.std(amounts) > 0:
                z_score = (amount - np.mean(amounts)) / np.std(amounts)
                features.append(abs(z_score))
            else:
                features.append(0)
        else:
            features.extend([0, 0, 0, 0])

        # 2. Vendor-based features
        vendor = invoice.get('vendor_name', '').lower()

        # Vendor frequency (how often this vendor appears)
        if historical_data:
            vendor_count = sum(1 for inv in historical_data
                             if inv.get('vendor_name', '').lower() == vendor)
            vendor_frequency = vendor_count / len(historical_data)
            features.append(vendor_frequency)
        else:
            features.append(0)

        # Is new vendor (binary)
        is_new_vendor = 1 if (not historical_data or
                             vendor not in [inv.get('vendor_name', '').lower()
                                          for inv in historical_data]) else 0
        features.append(is_new_vendor)

        # 3. Date-based features
        invoice_date = invoice.get('invoice_date')
        if invoice_date:
            try:
                date_obj = datetime.fromisoformat(invoice_date.replace('Z', '+00:00'))
                day_of_week = date_obj.weekday()  # 0-6
                day_of_month = date_obj.day
                month = date_obj.month

                features.append(day_of_week)
                features.append(day_of_month)
                features.append(month)

                # Is weekend
                is_weekend = 1 if day_of_week >= 5 else 0
                features.append(is_weekend)

                # Days from today
                days_diff = (datetime.utcnow() - date_obj).days
                features.append(days_diff)

            except Exception:
                features.extend([0, 0, 0, 0, 0])
        else:
            features.extend([0, 0, 0, 0, 0])

        # 4. Duplicate detection features
        duplicate_score = self._calculate_duplicate_score(invoice, historical_data)
        features.append(duplicate_score)

        # 5. Text-based features
        invoice_number = invoice.get('invoice_number', '')
        features.append(len(invoice_number))  # Invoice number length

        # Has PO number
        has_po = 1 if invoice.get('po_number') else 0
        features.append(has_po)

        # Number of line items
        line_items = invoice.get('line_items', [])
        features.append(len(line_items))

        # 6. Tax and discount features
        tax_amount = float(invoice.get('tax_amount', 0))
        subtotal = float(invoice.get('subtotal', 0))

        # Tax rate
        tax_rate = (tax_amount / subtotal * 100) if subtotal > 0 else 0
        features.append(tax_rate)

        # Has discount
        discount = float(invoice.get('discount', 0))
        has_discount = 1 if discount > 0 else 0
        features.append(has_discount)

        # Discount percentage
        discount_pct = (discount / subtotal * 100) if subtotal > 0 else 0
        features.append(discount_pct)

        # 7. Payment terms features
        payment_terms = invoice.get('payment_terms', '')
        features.append(len(payment_terms))

        # Due date features
        due_date = invoice.get('due_date')
        if due_date and invoice_date:
            try:
                due_obj = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
                inv_obj = datetime.fromisoformat(invoice_date.replace('Z', '+00:00'))
                payment_days = (due_obj - inv_obj).days
                features.append(payment_days)
            except Exception:
                features.append(0)
        else:
            features.append(0)

        return np.array(features).reshape(1, -1)

    def _calculate_duplicate_score(self, invoice: Dict[str, Any],
                                   historical_data: List[Dict[str, Any]]) -> float:
        """
        Calculate likelihood of duplicate invoice

        Args:
            invoice: Current invoice
            historical_data: Historical invoices

        Returns:
            Duplicate score (0-1)
        """
        if not historical_data:
            return 0.0

        max_score = 0.0
        invoice_number = invoice.get('invoice_number', '').lower()
        amount = float(invoice.get('total_amount', 0))
        vendor = invoice.get('vendor_name', '').lower()

        for hist_inv in historical_data:
            score = 0.0

            # Same invoice number
            if invoice_number and invoice_number == hist_inv.get('invoice_number', '').lower():
                score += 0.5

            # Same amount
            hist_amount = float(hist_inv.get('total_amount', 0))
            if amount > 0 and abs(amount - hist_amount) / amount < 0.01:  # Within 1%
                score += 0.3

            # Same vendor
            if vendor and vendor == hist_inv.get('vendor_name', '').lower():
                score += 0.2

            max_score = max(max_score, score)

        return max_score

    def train_model(self, training_data: List[Dict[str, Any]],
                   labels: List[int]) -> Dict[str, Any]:
        """
        Train fraud detection models

        Args:
            training_data: List of invoice feature dictionaries
            labels: Binary labels (0=legitimate, 1=fraud)

        Returns:
            Training results and metrics
        """
        if len(training_data) < 10:
            raise ValueError('Insufficient training data (minimum 10 samples)')

        logger.info(f'Training fraud detection model with {len(training_data)} samples')

        # Extract features
        X = []
        for invoice in training_data:
            features = self.extract_features(invoice, training_data)
            X.append(features.flatten())

        X = np.array(X)
        y = np.array(labels)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y if len(np.unique(y)) > 1 else None
        )

        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # Train Random Forest classifier
        self.rf_classifier = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            class_weight='balanced'
        )
        self.rf_classifier.fit(X_train_scaled, y_train)

        # Train Isolation Forest for anomaly detection
        self.isolation_forest = IsolationForest(
            contamination=0.1,
            random_state=42
        )
        self.isolation_forest.fit(X_train_scaled)

        self.is_trained = True

        # Evaluate
        y_pred = self.rf_classifier.predict(X_test_scaled)
        accuracy = np.mean(y_pred == y_test)

        # Classification report
        report = classification_report(y_test, y_pred, output_dict=True)
        conf_matrix = confusion_matrix(y_test, y_pred)

        # Feature importance
        feature_importance = self.rf_classifier.feature_importances_

        logger.info(f'Model trained with accuracy: {accuracy:.4f}')

        # Save model
        self.save_model()

        return {
            'accuracy': accuracy,
            'precision': report.get('1', {}).get('precision', 0),
            'recall': report.get('1', {}).get('recall', 0),
            'f1_score': report.get('1', {}).get('f1-score', 0),
            'confusion_matrix': conf_matrix.tolist(),
            'feature_importance': feature_importance.tolist(),
            'samples_trained': len(training_data),
            'fraud_samples': int(np.sum(labels)),
            'legitimate_samples': int(len(labels) - np.sum(labels))
        }

    def predict_fraud(self, invoice: Dict[str, Any],
                     historical_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Predict fraud probability for an invoice

        Args:
            invoice: Invoice data
            historical_data: Historical invoices for context

        Returns:
            Fraud prediction results
        """
        # Extract features
        features = self.extract_features(invoice, historical_data)

        # Rule-based detection (always active)
        rule_based_risk = self._rule_based_detection(invoice, historical_data)

        # ML-based detection (if model is trained)
        ml_risk_score = 0.0
        ml_prediction = 0
        anomaly_score = 0.0

        if self.is_trained and self.rf_classifier and self.isolation_forest:
            features_scaled = self.scaler.transform(features)

            # Random Forest prediction
            ml_prediction = self.rf_classifier.predict(features_scaled)[0]
            ml_proba = self.rf_classifier.predict_proba(features_scaled)[0]
            ml_risk_score = ml_proba[1] if len(ml_proba) > 1 else 0

            # Isolation Forest anomaly score
            anomaly_prediction = self.isolation_forest.predict(features_scaled)[0]
            anomaly_score = 1.0 if anomaly_prediction == -1 else 0.0

        # Combine scores (weighted average)
        combined_score = (
            0.4 * rule_based_risk +
            0.4 * ml_risk_score +
            0.2 * anomaly_score
        )

        # Determine risk level
        risk_level = self._get_risk_level(combined_score)

        # Identify specific risk factors
        risk_factors = self._identify_risk_factors(invoice, historical_data, combined_score)

        return {
            'fraud_probability': float(combined_score),
            'risk_level': risk_level,
            'ml_prediction': int(ml_prediction),
            'ml_confidence': float(ml_risk_score),
            'anomaly_detected': bool(anomaly_score > 0.5),
            'rule_based_score': float(rule_based_risk),
            'risk_factors': risk_factors,
            'recommendation': self._get_recommendation(risk_level)
        }

    def _rule_based_detection(self, invoice: Dict[str, Any],
                              historical_data: List[Dict[str, Any]]) -> float:
        """
        Rule-based fraud detection

        Args:
            invoice: Invoice data
            historical_data: Historical invoices

        Returns:
            Risk score (0-1)
        """
        risk_score = 0.0

        amount = float(invoice.get('total_amount', 0))

        # High amount threshold
        if amount > 10000:
            risk_score += 0.2

        # Duplicate detection
        duplicate_score = self._calculate_duplicate_score(invoice, historical_data)
        risk_score += duplicate_score * 0.3

        # New vendor with high amount
        vendor = invoice.get('vendor_name', '').lower()
        is_new_vendor = (not historical_data or
                        vendor not in [inv.get('vendor_name', '').lower()
                                     for inv in historical_data])
        if is_new_vendor and amount > 5000:
            risk_score += 0.25

        # Round number amounts (often fraudulent)
        if amount > 0 and amount % 100 == 0:
            risk_score += 0.1

        # Missing critical fields
        missing_fields = 0
        critical_fields = ['invoice_number', 'vendor_name', 'invoice_date', 'total_amount']
        for field in critical_fields:
            if not invoice.get(field):
                missing_fields += 1

        risk_score += (missing_fields / len(critical_fields)) * 0.15

        return min(risk_score, 1.0)

    def _get_risk_level(self, score: float) -> str:
        """Get risk level from score"""
        if score >= self.RISK_THRESHOLDS['high']:
            return 'high'
        elif score >= self.RISK_THRESHOLDS['medium']:
            return 'medium'
        else:
            return 'low'

    def _identify_risk_factors(self, invoice: Dict[str, Any],
                               historical_data: List[Dict[str, Any]],
                               risk_score: float) -> List[str]:
        """Identify specific risk factors"""
        factors = []

        amount = float(invoice.get('total_amount', 0))
        vendor = invoice.get('vendor_name', '').lower()

        # High amount
        if amount > 10000:
            factors.append('High invoice amount')

        # Duplicate
        if self._calculate_duplicate_score(invoice, historical_data) > 0.5:
            factors.append('Potential duplicate invoice')

        # New vendor
        is_new = (not historical_data or
                 vendor not in [inv.get('vendor_name', '').lower() for inv in historical_data])
        if is_new:
            factors.append('New vendor')

        # Round amount
        if amount > 0 and amount % 100 == 0:
            factors.append('Round number amount')

        # Missing fields
        if not invoice.get('invoice_number'):
            factors.append('Missing invoice number')

        # Anomaly detected
        if risk_score > self.RISK_THRESHOLDS['high']:
            factors.append('Statistical anomaly detected')

        return factors

    def _get_recommendation(self, risk_level: str) -> str:
        """Get action recommendation based on risk level"""
        recommendations = {
            'low': 'Approve for processing',
            'medium': 'Review recommended before approval',
            'high': 'Manual review required - do not auto-approve'
        }
        return recommendations.get(risk_level, 'Review required')

    def save_model(self):
        """Save trained model to disk"""
        if not self.is_trained:
            logger.warning('Cannot save untrained model')
            return

        # Create models directory if doesn't exist
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)

        model_data = {
            'rf_classifier': self.rf_classifier,
            'isolation_forest': self.isolation_forest,
            'scaler': self.scaler,
            'is_trained': self.is_trained
        }

        with open(self.model_path, 'wb') as f:
            pickle.dump(model_data, f)

        logger.info(f'Model saved to {self.model_path}')

    def load_model(self):
        """Load trained model from disk"""
        if not os.path.exists(self.model_path):
            logger.warning(f'Model file not found: {self.model_path}')
            return

        try:
            with open(self.model_path, 'rb') as f:
                model_data = pickle.load(f)

            self.rf_classifier = model_data['rf_classifier']
            self.isolation_forest = model_data['isolation_forest']
            self.scaler = model_data['scaler']
            self.is_trained = model_data['is_trained']

            logger.info(f'Model loaded from {self.model_path}')

        except Exception as e:
            logger.error(f'Error loading model: {e}')


# Helper function for FastAPI integration
def create_fraud_detector(model_path: Optional[str] = None) -> FraudDetectionML:
    """
    Create fraud detection instance

    Args:
        model_path: Path to model file

    Returns:
        FraudDetectionML instance
    """
    return FraudDetectionML(model_path=model_path)
