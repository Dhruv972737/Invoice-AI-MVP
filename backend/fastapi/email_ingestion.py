"""
Email Ingestion System for Invoice AI
Handles email attachment processing and automatic invoice detection
"""
import os
import email
import imaplib
import logging
from email.header import decode_header
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import mimetypes
from pathlib import Path

logger = logging.getLogger(__name__)

class EmailIngestionService:
    """
    Email ingestion service that monitors inbox and extracts invoice attachments
    """

    SUPPORTED_MIME_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

    INVOICE_KEYWORDS = [
        'invoice', 'receipt', 'bill', 'statement',
        'factura', 'rechnung', 'fattura'  # Multilingual
    ]

    def __init__(self, email_host: str, email_user: str, email_password: str,
                 email_port: int = 993, use_ssl: bool = True):
        """
        Initialize email ingestion service

        Args:
            email_host: IMAP server hostname (e.g., imap.gmail.com)
            email_user: Email account username
            email_password: Email account password or app-specific password
            email_port: IMAP port (default 993 for SSL)
            use_ssl: Use SSL connection (default True)
        """
        self.email_host = email_host
        self.email_user = email_user
        self.email_password = email_password
        self.email_port = email_port
        self.use_ssl = use_ssl
        self.mail = None

    def connect(self) -> bool:
        """Connect to IMAP server"""
        try:
            if self.use_ssl:
                self.mail = imaplib.IMAP4_SSL(self.email_host, self.email_port)
            else:
                self.mail = imaplib.IMAP4(self.email_host, self.email_port)

            self.mail.login(self.email_user, self.email_password)
            logger.info(f'Connected to {self.email_host} as {self.email_user}')
            return True
        except Exception as e:
            logger.error(f'Failed to connect to email server: {e}')
            return False

    def disconnect(self):
        """Disconnect from IMAP server"""
        if self.mail:
            try:
                self.mail.logout()
                logger.info('Disconnected from email server')
            except Exception as e:
                logger.error(f'Error disconnecting: {e}')

    def get_unread_emails(self, folder: str = 'INBOX', limit: Optional[int] = 50) -> List[bytes]:
        """
        Fetch unread emails from specified folder

        Args:
            folder: Email folder to check (default INBOX)
            limit: Maximum number of emails to fetch

        Returns:
            List of email IDs
        """
        try:
            self.mail.select(folder)
            status, messages = self.mail.search(None, 'UNSEEN')

            if status != 'OK':
                logger.error(f'Failed to search emails: {status}')
                return []

            email_ids = messages[0].split()

            if limit:
                email_ids = email_ids[-limit:]  # Get most recent emails

            logger.info(f'Found {len(email_ids)} unread emails')
            return email_ids
        except Exception as e:
            logger.error(f'Error fetching unread emails: {e}')
            return []

    def extract_attachments(self, email_id: bytes) -> List[Dict]:
        """
        Extract attachments from an email

        Args:
            email_id: Email ID to process

        Returns:
            List of attachment dictionaries with filename, content, mime_type
        """
        attachments = []

        try:
            status, msg_data = self.mail.fetch(email_id, '(RFC822)')

            if status != 'OK':
                logger.error(f'Failed to fetch email {email_id}')
                return attachments

            email_body = msg_data[0][1]
            email_message = email.message_from_bytes(email_body)

            # Extract sender and subject for context
            sender = email_message.get('From', '')
            subject = self._decode_header(email_message.get('Subject', ''))

            logger.info(f'Processing email from {sender}: {subject}')

            # Walk through email parts
            for part in email_message.walk():
                if part.get_content_maintype() == 'multipart':
                    continue

                if part.get('Content-Disposition') is None:
                    continue

                filename = part.get_filename()

                if filename:
                    filename = self._decode_header(filename)
                    content_type = part.get_content_type()

                    # Check if this is a supported file type
                    if content_type in self.SUPPORTED_MIME_TYPES:
                        # Check if filename suggests it's an invoice
                        if self._is_likely_invoice(filename, subject):
                            content = part.get_payload(decode=True)

                            attachments.append({
                                'filename': filename,
                                'content': content,
                                'mime_type': content_type,
                                'sender': sender,
                                'subject': subject,
                                'email_id': email_id.decode(),
                                'timestamp': datetime.utcnow().isoformat()
                            })

                            logger.info(f'Found invoice attachment: {filename} ({content_type})')

        except Exception as e:
            logger.error(f'Error extracting attachments from email {email_id}: {e}')

        return attachments

    def _decode_header(self, header: str) -> str:
        """Decode email header to UTF-8 string"""
        if not header:
            return ''

        try:
            decoded_parts = decode_header(header)
            decoded_str = ''

            for part, encoding in decoded_parts:
                if isinstance(part, bytes):
                    decoded_str += part.decode(encoding or 'utf-8', errors='ignore')
                else:
                    decoded_str += part

            return decoded_str
        except Exception as e:
            logger.error(f'Error decoding header: {e}')
            return str(header)

    def _is_likely_invoice(self, filename: str, subject: str) -> bool:
        """
        Check if file/subject suggests it's an invoice

        Args:
            filename: Attachment filename
            subject: Email subject line

        Returns:
            True if likely an invoice, False otherwise
        """
        text_to_check = (filename + ' ' + subject).lower()

        return any(keyword in text_to_check for keyword in self.INVOICE_KEYWORDS)

    def mark_as_read(self, email_id: bytes):
        """Mark email as read"""
        try:
            self.mail.store(email_id, '+FLAGS', '\\Seen')
        except Exception as e:
            logger.error(f'Error marking email as read: {e}')

    def mark_as_processed(self, email_id: bytes, folder: str = 'Processed'):
        """
        Move email to processed folder

        Args:
            email_id: Email ID
            folder: Destination folder name
        """
        try:
            # Copy to processed folder
            self.mail.copy(email_id, folder)
            # Mark for deletion in inbox
            self.mail.store(email_id, '+FLAGS', '\\Deleted')
            self.mail.expunge()
            logger.info(f'Moved email {email_id} to {folder}')
        except Exception as e:
            logger.error(f'Error moving email to processed: {e}')

    def process_inbox(self, auto_mark_read: bool = True,
                     auto_move: bool = False,
                     limit: Optional[int] = 50) -> List[Dict]:
        """
        Process inbox and extract all invoice attachments

        Args:
            auto_mark_read: Mark emails as read after processing
            auto_move: Move processed emails to Processed folder
            limit: Maximum emails to process

        Returns:
            List of all extracted attachments
        """
        all_attachments = []

        if not self.connect():
            return all_attachments

        try:
            email_ids = self.get_unread_emails(limit=limit)

            for email_id in email_ids:
                attachments = self.extract_attachments(email_id)
                all_attachments.extend(attachments)

                if auto_mark_read:
                    self.mark_as_read(email_id)

                if auto_move and attachments:
                    self.mark_as_processed(email_id)

        finally:
            self.disconnect()

        logger.info(f'Extracted {len(all_attachments)} invoice attachments')
        return all_attachments


# Helper function for FastAPI integration
def create_email_service() -> Optional[EmailIngestionService]:
    """
    Create email ingestion service from environment variables

    Returns:
        EmailIngestionService instance or None if not configured
    """
    email_host = os.getenv('EMAIL_IMAP_HOST')
    email_user = os.getenv('EMAIL_IMAP_USER')
    email_password = os.getenv('EMAIL_IMAP_PASSWORD')
    email_port = int(os.getenv('EMAIL_IMAP_PORT', '993'))

    if not all([email_host, email_user, email_password]):
        logger.warning('Email ingestion not configured - missing environment variables')
        return None

    return EmailIngestionService(
        email_host=email_host,
        email_user=email_user,
        email_password=email_password,
        email_port=email_port,
        use_ssl=True
    )
