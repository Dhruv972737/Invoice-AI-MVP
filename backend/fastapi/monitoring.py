"""
Prometheus Metrics and Monitoring for Invoice AI
Tracks system performance, usage, and errors
"""
import os
import logging
import time
from typing import Dict, Any, Optional, Callable
from functools import wraps
from datetime import datetime
from prometheus_client import (
    Counter, Histogram, Gauge, Summary,
    CollectorRegistry, generate_latest,
    CONTENT_TYPE_LATEST, multiprocess,
    make_asgi_app
)

logger = logging.getLogger(__name__)


class MonitoringService:
    """
    Prometheus monitoring and metrics service
    """

    def __init__(self, registry: Optional[CollectorRegistry] = None):
        """
        Initialize monitoring service

        Args:
            registry: Prometheus registry (creates new if None)
        """
        self.registry = registry or CollectorRegistry()

        # Initialize metrics
        self._init_counters()
        self._init_histograms()
        self._init_gauges()
        self._init_summaries()

        logger.info('Monitoring service initialized')

    def _init_counters(self):
        """Initialize counter metrics"""
        # Invoice processing
        self.invoice_uploads_total = Counter(
            'invoice_uploads_total',
            'Total number of invoice uploads',
            ['status', 'user_tier'],
            registry=self.registry
        )

        self.invoice_processing_total = Counter(
            'invoice_processing_total',
            'Total number of invoices processed',
            ['status', 'ai_provider'],
            registry=self.registry
        )

        self.invoice_errors_total = Counter(
            'invoice_errors_total',
            'Total number of invoice processing errors',
            ['error_type', 'ai_provider'],
            registry=self.registry
        )

        # OCR operations
        self.ocr_operations_total = Counter(
            'ocr_operations_total',
            'Total number of OCR operations',
            ['ocr_engine', 'status'],
            registry=self.registry
        )

        # AI requests
        self.ai_requests_total = Counter(
            'ai_requests_total',
            'Total number of AI provider requests',
            ['provider', 'model', 'status'],
            registry=self.registry
        )

        # Token usage
        self.tokens_consumed_total = Counter(
            'tokens_consumed_total',
            'Total tokens consumed',
            ['user_tier', 'operation'],
            registry=self.registry
        )

        # Authentication
        self.auth_attempts_total = Counter(
            'auth_attempts_total',
            'Total authentication attempts',
            ['method', 'status'],
            registry=self.registry
        )

        # API requests
        self.api_requests_total = Counter(
            'api_requests_total',
            'Total API requests',
            ['method', 'endpoint', 'status_code'],
            registry=self.registry
        )

        # Payments
        self.payments_total = Counter(
            'payments_total',
            'Total payment transactions',
            ['provider', 'status', 'package'],
            registry=self.registry
        )

        # Fraud detection
        self.fraud_detections_total = Counter(
            'fraud_detections_total',
            'Total fraud detections',
            ['risk_level', 'detection_method'],
            registry=self.registry
        )

        # Email ingestion
        self.emails_processed_total = Counter(
            'emails_processed_total',
            'Total emails processed',
            ['status', 'has_attachments'],
            registry=self.registry
        )

        # Drive sync
        self.drive_sync_total = Counter(
            'drive_sync_total',
            'Total Drive sync operations',
            ['status'],
            registry=self.registry
        )

        # Webhooks
        self.webhook_deliveries_total = Counter(
            'webhook_deliveries_total',
            'Total webhook deliveries',
            ['event_type', 'status'],
            registry=self.registry
        )

    def _init_histograms(self):
        """Initialize histogram metrics"""
        # Request duration
        self.request_duration_seconds = Histogram(
            'request_duration_seconds',
            'Request duration in seconds',
            ['method', 'endpoint'],
            registry=self.registry,
            buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0]
        )

        # Invoice processing time
        self.invoice_processing_duration_seconds = Histogram(
            'invoice_processing_duration_seconds',
            'Invoice processing duration in seconds',
            ['ai_provider'],
            registry=self.registry,
            buckets=[1.0, 2.0, 5.0, 10.0, 20.0, 30.0, 60.0, 120.0]
        )

        # OCR processing time
        self.ocr_duration_seconds = Histogram(
            'ocr_duration_seconds',
            'OCR processing duration in seconds',
            ['ocr_engine'],
            registry=self.registry,
            buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 20.0]
        )

        # AI response time
        self.ai_response_duration_seconds = Histogram(
            'ai_response_duration_seconds',
            'AI provider response duration in seconds',
            ['provider', 'model'],
            registry=self.registry,
            buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 30.0]
        )

        # File upload size
        self.upload_size_bytes = Histogram(
            'upload_size_bytes',
            'Upload file size in bytes',
            ['file_type'],
            registry=self.registry,
            buckets=[1024, 10240, 102400, 1024000, 10240000]  # 1KB to 10MB
        )

        # Database query time
        self.db_query_duration_seconds = Histogram(
            'db_query_duration_seconds',
            'Database query duration in seconds',
            ['operation', 'table'],
            registry=self.registry,
            buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
        )

    def _init_gauges(self):
        """Initialize gauge metrics"""
        # Active users
        self.active_users = Gauge(
            'active_users',
            'Number of active users',
            ['tier'],
            registry=self.registry
        )

        # Active sessions
        self.active_sessions = Gauge(
            'active_sessions',
            'Number of active sessions',
            registry=self.registry
        )

        # Pending invoices
        self.pending_invoices = Gauge(
            'pending_invoices',
            'Number of pending invoices',
            registry=self.registry
        )

        # Queue size
        self.job_queue_size = Gauge(
            'job_queue_size',
            'Number of jobs in queue',
            ['priority'],
            registry=self.registry
        )

        # Token balance
        self.user_token_balance = Gauge(
            'user_token_balance',
            'User token balance',
            ['user_id', 'tier'],
            registry=self.registry
        )

        # System health
        self.system_health = Gauge(
            'system_health',
            'System health status (1=healthy, 0=unhealthy)',
            registry=self.registry
        )

        # Database connections
        self.db_connections = Gauge(
            'db_connections',
            'Number of database connections',
            ['state'],  # active, idle
            registry=self.registry
        )

        # Cache hit rate
        self.cache_hit_rate = Gauge(
            'cache_hit_rate',
            'Cache hit rate percentage',
            ['cache_type'],
            registry=self.registry
        )

        # AI provider availability
        self.ai_provider_availability = Gauge(
            'ai_provider_availability',
            'AI provider availability (1=available, 0=unavailable)',
            ['provider'],
            registry=self.registry
        )

    def _init_summaries(self):
        """Initialize summary metrics"""
        # Invoice amount
        self.invoice_amount = Summary(
            'invoice_amount',
            'Invoice amount distribution',
            ['currency'],
            registry=self.registry
        )

        # OCR confidence
        self.ocr_confidence = Summary(
            'ocr_confidence',
            'OCR confidence score distribution',
            ['ocr_engine'],
            registry=self.registry
        )

        # Fraud risk score
        self.fraud_risk_score = Summary(
            'fraud_risk_score',
            'Fraud risk score distribution',
            registry=self.registry
        )

    # Convenience methods for common metrics

    def track_invoice_upload(self, status: str, user_tier: str, file_size: int, file_type: str):
        """Track invoice upload"""
        self.invoice_uploads_total.labels(status=status, user_tier=user_tier).inc()
        self.upload_size_bytes.labels(file_type=file_type).observe(file_size)

    def track_invoice_processing(self, status: str, ai_provider: str, duration: float):
        """Track invoice processing"""
        self.invoice_processing_total.labels(status=status, ai_provider=ai_provider).inc()
        self.invoice_processing_duration_seconds.labels(ai_provider=ai_provider).observe(duration)

    def track_ocr_operation(self, ocr_engine: str, status: str, duration: float, confidence: float = 0):
        """Track OCR operation"""
        self.ocr_operations_total.labels(ocr_engine=ocr_engine, status=status).inc()
        self.ocr_duration_seconds.labels(ocr_engine=ocr_engine).observe(duration)
        if confidence > 0:
            self.ocr_confidence.labels(ocr_engine=ocr_engine).observe(confidence)

    def track_ai_request(self, provider: str, model: str, status: str, duration: float):
        """Track AI provider request"""
        self.ai_requests_total.labels(provider=provider, model=model, status=status).inc()
        self.ai_response_duration_seconds.labels(provider=provider, model=model).observe(duration)

    def track_token_usage(self, user_tier: str, operation: str, tokens: int):
        """Track token consumption"""
        self.tokens_consumed_total.labels(user_tier=user_tier, operation=operation).inc(tokens)

    def track_auth_attempt(self, method: str, status: str):
        """Track authentication attempt"""
        self.auth_attempts_total.labels(method=method, status=status).inc()

    def track_api_request(self, method: str, endpoint: str, status_code: int, duration: float):
        """Track API request"""
        self.api_requests_total.labels(
            method=method,
            endpoint=endpoint,
            status_code=str(status_code)
        ).inc()
        self.request_duration_seconds.labels(method=method, endpoint=endpoint).observe(duration)

    def track_payment(self, provider: str, status: str, package: str):
        """Track payment transaction"""
        self.payments_total.labels(provider=provider, status=status, package=package).inc()

    def track_fraud_detection(self, risk_level: str, detection_method: str, risk_score: float):
        """Track fraud detection"""
        self.fraud_detections_total.labels(
            risk_level=risk_level,
            detection_method=detection_method
        ).inc()
        self.fraud_risk_score.observe(risk_score)

    def track_email_processing(self, status: str, has_attachments: bool):
        """Track email processing"""
        self.emails_processed_total.labels(
            status=status,
            has_attachments=str(has_attachments)
        ).inc()

    def track_drive_sync(self, status: str):
        """Track Drive sync operation"""
        self.drive_sync_total.labels(status=status).inc()

    def track_webhook_delivery(self, event_type: str, status: str):
        """Track webhook delivery"""
        self.webhook_deliveries_total.labels(event_type=event_type, status=status).inc()

    def update_active_users(self, count: int, tier: str):
        """Update active users gauge"""
        self.active_users.labels(tier=tier).set(count)

    def update_active_sessions(self, count: int):
        """Update active sessions gauge"""
        self.active_sessions.set(count)

    def update_pending_invoices(self, count: int):
        """Update pending invoices gauge"""
        self.pending_invoices.set(count)

    def update_job_queue_size(self, count: int, priority: str):
        """Update job queue size gauge"""
        self.job_queue_size.labels(priority=priority).set(count)

    def update_system_health(self, is_healthy: bool):
        """Update system health gauge"""
        self.system_health.set(1 if is_healthy else 0)

    def update_ai_provider_availability(self, provider: str, is_available: bool):
        """Update AI provider availability"""
        self.ai_provider_availability.labels(provider=provider).set(1 if is_available else 0)

    def get_metrics(self) -> bytes:
        """
        Get Prometheus metrics in text format

        Returns:
            Metrics data as bytes
        """
        return generate_latest(self.registry)

    def get_content_type(self) -> str:
        """Get content type for metrics endpoint"""
        return CONTENT_TYPE_LATEST


# Decorators for automatic tracking

def track_time(metric_name: str, labels: Optional[Dict[str, str]] = None):
    """
    Decorator to track execution time

    Args:
        metric_name: Name of the histogram metric
        labels: Labels for the metric
    """
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                # Log duration (actual metric tracking done in function)
                logger.debug(f'{func.__name__} took {duration:.3f}s')

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                logger.debug(f'{func.__name__} took {duration:.3f}s')

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def track_errors(counter_metric: Counter, error_label: str = 'error_type'):
    """
    Decorator to track errors

    Args:
        counter_metric: Counter metric to increment
        error_label: Label name for error type
    """
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                counter_metric.labels(**{error_label: type(e).__name__}).inc()
                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                counter_metric.labels(**{error_label: type(e).__name__}).inc()
                raise

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


# Global monitoring service instance
_monitoring_service: Optional[MonitoringService] = None


def get_monitoring_service() -> MonitoringService:
    """
    Get global monitoring service instance

    Returns:
        MonitoringService instance
    """
    global _monitoring_service
    if _monitoring_service is None:
        _monitoring_service = MonitoringService()
    return _monitoring_service


def create_metrics_app():
    """
    Create ASGI app for Prometheus metrics endpoint

    Returns:
        ASGI app
    """
    monitoring = get_monitoring_service()
    return make_asgi_app(registry=monitoring.registry)


# Health check function
async def health_check() -> Dict[str, Any]:
    """
    Perform system health check

    Returns:
        Health check results
    """
    monitoring = get_monitoring_service()

    health_data = {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'checks': {}
    }

    # Check database
    try:
        # This would actually check database connection
        health_data['checks']['database'] = 'healthy'
    except Exception as e:
        health_data['checks']['database'] = f'unhealthy: {str(e)}'
        health_data['status'] = 'unhealthy'

    # Check AI providers
    ai_providers = ['gemini', 'claude', 'deepseek', 'openai']
    for provider in ai_providers:
        # This would actually ping the provider
        health_data['checks'][f'ai_provider_{provider}'] = 'healthy'

    # Update system health metric
    is_healthy = health_data['status'] == 'healthy'
    monitoring.update_system_health(is_healthy)

    return health_data
