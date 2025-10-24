"""
Background Job Queue System for Invoice AI
Handles asynchronous task processing with retry logic and monitoring
"""
import os
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from enum import Enum
import asyncio
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    """Job status enumeration"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"


class JobPriority(str, Enum):
    """Job priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Job:
    """Job data structure"""
    id: str
    type: str
    payload: Dict[str, Any]
    status: JobStatus = JobStatus.PENDING
    priority: JobPriority = JobPriority.NORMAL
    attempts: int = 0
    max_retries: int = 3
    error_message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    created_at: str = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()


class JobQueue:
    """
    In-memory job queue with persistence to database
    For production, use Redis/Bull/Celery
    """

    def __init__(self, supabase_client=None):
        """
        Initialize job queue

        Args:
            supabase_client: Supabase client for persistence
        """
        self.jobs: Dict[str, Job] = {}
        self.supabase = supabase_client
        self.running = False
        self._worker_task = None

    async def add_job(self, job_type: str, payload: Dict[str, Any],
                     priority: JobPriority = JobPriority.NORMAL,
                     max_retries: int = 3) -> str:
        """
        Add a job to the queue

        Args:
            job_type: Type of job (e.g., 'process_invoice', 'email_ingestion')
            payload: Job data
            priority: Job priority
            max_retries: Maximum retry attempts

        Returns:
            Job ID
        """
        import uuid
        job_id = str(uuid.uuid4())

        job = Job(
            id=job_id,
            type=job_type,
            payload=payload,
            priority=priority,
            max_retries=max_retries
        )

        self.jobs[job_id] = job

        # Persist to database
        if self.supabase:
            try:
                self.supabase.table('job_queue').insert({
                    'id': job_id,
                    'type': job_type,
                    'payload': json.dumps(payload),
                    'status': job.status.value,
                    'priority': job.priority.value,
                    'max_retries': max_retries,
                    'created_at': job.created_at
                }).execute()
            except Exception as e:
                logger.error(f'Failed to persist job to database: {e}')

        logger.info(f'Added job {job_id} of type {job_type} with priority {priority.value}')
        return job_id

    async def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID"""
        return self.jobs.get(job_id)

    async def update_job_status(self, job_id: str, status: JobStatus,
                               error_message: Optional[str] = None,
                               result: Optional[Dict[str, Any]] = None):
        """Update job status"""
        job = self.jobs.get(job_id)
        if not job:
            logger.warning(f'Job {job_id} not found')
            return

        job.status = status
        if error_message:
            job.error_message = error_message
        if result:
            job.result = result

        if status == JobStatus.PROCESSING and not job.started_at:
            job.started_at = datetime.utcnow().isoformat()
        elif status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
            job.completed_at = datetime.utcnow().isoformat()

        # Update database
        if self.supabase:
            try:
                update_data = {
                    'status': status.value,
                    'error_message': error_message,
                    'result': json.dumps(result) if result else None,
                    'started_at': job.started_at,
                    'completed_at': job.completed_at
                }
                self.supabase.table('job_queue').update(update_data).eq('id', job_id).execute()
            except Exception as e:
                logger.error(f'Failed to update job in database: {e}')

    async def get_next_job(self) -> Optional[Job]:
        """
        Get next pending job based on priority

        Returns:
            Next job to process or None
        """
        # Sort by priority and creation time
        priority_order = {
            JobPriority.CRITICAL: 0,
            JobPriority.HIGH: 1,
            JobPriority.NORMAL: 2,
            JobPriority.LOW: 3
        }

        pending_jobs = [
            job for job in self.jobs.values()
            if job.status == JobStatus.PENDING
        ]

        if not pending_jobs:
            return None

        # Sort by priority then by creation time
        sorted_jobs = sorted(
            pending_jobs,
            key=lambda j: (priority_order.get(j.priority, 999), j.created_at)
        )

        return sorted_jobs[0] if sorted_jobs else None

    async def process_job(self, job: Job) -> bool:
        """
        Process a single job

        Args:
            job: Job to process

        Returns:
            True if successful, False otherwise
        """
        logger.info(f'Processing job {job.id} of type {job.type}')

        job.attempts += 1
        await self.update_job_status(job.id, JobStatus.PROCESSING)

        try:
            # Route to appropriate handler based on job type
            if job.type == 'process_invoice':
                result = await self._process_invoice_job(job.payload)
            elif job.type == 'email_ingestion':
                result = await self._process_email_ingestion_job(job.payload)
            elif job.type == 'generate_report':
                result = await self._process_report_job(job.payload)
            elif job.type == 'export_data':
                result = await self._process_export_job(job.payload)
            else:
                raise ValueError(f'Unknown job type: {job.type}')

            await self.update_job_status(job.id, JobStatus.COMPLETED, result=result)
            logger.info(f'Job {job.id} completed successfully')
            return True

        except Exception as e:
            error_msg = str(e)
            logger.error(f'Job {job.id} failed: {error_msg}')

            # Retry logic
            if job.attempts < job.max_retries:
                logger.info(f'Retrying job {job.id} (attempt {job.attempts + 1}/{job.max_retries})')
                await self.update_job_status(job.id, JobStatus.RETRYING, error_message=error_msg)
                # Reset to pending for retry
                await asyncio.sleep(2 ** job.attempts)  # Exponential backoff
                await self.update_job_status(job.id, JobStatus.PENDING)
            else:
                logger.error(f'Job {job.id} failed after {job.max_retries} attempts')
                await self.update_job_status(job.id, JobStatus.FAILED, error_message=error_msg)

            return False

    async def _process_invoice_job(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process invoice job"""
        invoice_id = payload.get('invoice_id')
        user_id = payload.get('user_id')

        logger.info(f'Processing invoice {invoice_id} for user {user_id}')

        # Import here to avoid circular dependency
        from main import supabase_admin

        if not supabase_admin:
            raise Exception('Supabase admin client not available')

        # Consume tokens
        supabase_admin.rpc('consume_tokens', {
            'p_user_id': user_id,
            'p_tokens_to_consume': 5,
            'p_agent_name': 'background_processor',
            'p_operation_type': 'full_pipeline',
            'p_ai_provider': 'local',
            'p_invoice_id': invoice_id
        }).execute()

        # Update invoice status
        supabase_admin.table('invoices').update({
            'status': 'completed',
            'tokens_used': 5,
            'processed_at': datetime.utcnow().isoformat() + 'Z'
        }).eq('id', invoice_id).execute()

        return {'invoice_id': invoice_id, 'status': 'completed'}

    async def _process_email_ingestion_job(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process email ingestion job"""
        from email_ingestion import create_email_service

        email_service = create_email_service()
        if not email_service:
            raise Exception('Email service not configured')

        attachments = email_service.process_inbox(
            auto_mark_read=True,
            auto_move=False,
            limit=payload.get('limit', 50)
        )

        return {'attachments_processed': len(attachments)}

    async def _process_report_job(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process report generation job"""
        logger.info(f'Generating report: {payload}')
        # Placeholder for report generation
        return {'report_generated': True}

    async def _process_export_job(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process data export job"""
        logger.info(f'Exporting data: {payload}')
        # Placeholder for data export
        return {'export_completed': True}

    async def start_worker(self, poll_interval: int = 5):
        """
        Start background worker to process jobs

        Args:
            poll_interval: Seconds between job checks
        """
        self.running = True
        logger.info(f'Job worker started (polling every {poll_interval}s)')

        while self.running:
            try:
                job = await self.get_next_job()

                if job:
                    await self.process_job(job)
                else:
                    await asyncio.sleep(poll_interval)

            except Exception as e:
                logger.error(f'Worker error: {e}')
                await asyncio.sleep(poll_interval)

    async def stop_worker(self):
        """Stop background worker"""
        self.running = False
        if self._worker_task:
            self._worker_task.cancel()
        logger.info('Job worker stopped')

    def get_stats(self) -> Dict[str, Any]:
        """Get queue statistics"""
        stats = {
            'total_jobs': len(self.jobs),
            'pending': sum(1 for j in self.jobs.values() if j.status == JobStatus.PENDING),
            'processing': sum(1 for j in self.jobs.values() if j.status == JobStatus.PROCESSING),
            'completed': sum(1 for j in self.jobs.values() if j.status == JobStatus.COMPLETED),
            'failed': sum(1 for j in self.jobs.values() if j.status == JobStatus.FAILED),
            'retrying': sum(1 for j in self.jobs.values() if j.status == JobStatus.RETRYING)
        }
        return stats


# Global job queue instance
_job_queue: Optional[JobQueue] = None


def get_job_queue(supabase_client=None) -> JobQueue:
    """Get or create global job queue instance"""
    global _job_queue
    if _job_queue is None:
        _job_queue = JobQueue(supabase_client)
    return _job_queue
