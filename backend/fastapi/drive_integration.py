"""
Google Drive Integration for Invoice AI
Handles file monitoring, automatic sync, and invoice extraction from Drive
"""
import os
import io
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

logger = logging.getLogger(__name__)


class DriveIntegrationService:
    """
    Google Drive integration service for automatic invoice file monitoring
    """

    # Scopes required for Drive API
    SCOPES = [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
    ]

    # Supported MIME types for invoice files
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

    def __init__(self, credentials: Optional[Dict[str, Any]] = None):
        """
        Initialize Drive integration service

        Args:
            credentials: Google OAuth2 credentials dict
        """
        self.credentials = credentials
        self.service = None
        if credentials:
            self._initialize_service()

    def _initialize_service(self):
        """Initialize Google Drive API service"""
        try:
            creds = Credentials.from_authorized_user_info(self.credentials, self.SCOPES)

            # Refresh if expired
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())

            self.service = build('drive', 'v3', credentials=creds)
            logger.info('Google Drive service initialized')
        except Exception as e:
            logger.error(f'Failed to initialize Drive service: {e}')
            raise

    @staticmethod
    def get_authorization_url(client_id: str, client_secret: str,
                             redirect_uri: str, state: Optional[str] = None) -> str:
        """
        Get OAuth2 authorization URL for Drive access

        Args:
            client_id: Google OAuth client ID
            client_secret: Google OAuth client secret
            redirect_uri: OAuth callback URL
            state: Optional state parameter

        Returns:
            Authorization URL to redirect user to
        """
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=DriveIntegrationService.SCOPES,
            redirect_uri=redirect_uri
        )

        if state:
            flow.state = state

        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )

        return authorization_url

    @staticmethod
    def exchange_code_for_credentials(code: str, client_id: str,
                                      client_secret: str, redirect_uri: str) -> Dict[str, Any]:
        """
        Exchange authorization code for credentials

        Args:
            code: Authorization code from OAuth callback
            client_id: Google OAuth client ID
            client_secret: Google OAuth client secret
            redirect_uri: OAuth callback URL

        Returns:
            Credentials dictionary
        """
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=DriveIntegrationService.SCOPES,
            redirect_uri=redirect_uri
        )

        # Disable strict scope checking to prevent Warning exceptions
        # Google adds extra scopes (openid, profile, email) which we accept
        import os
        os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

        flow.fetch_token(code=code)
        credentials = flow.credentials
        return {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }

    def list_files(self, folder_id: Optional[str] = None,
                   page_size: int = 100,
                   query_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List files from Google Drive

        Args:
            folder_id: Specific folder ID to search (None for all accessible files)
            page_size: Number of files per page
            query_filter: Additional query filter

        Returns:
            List of file metadata dictionaries
        """
        if not self.service:
            raise Exception('Drive service not initialized')

        try:
            # Build query
            query_parts = []

            # Filter by folder
            if folder_id:
                query_parts.append(f"'{folder_id}' in parents")

            # Filter by MIME type (only supported types)
            mime_query = ' or '.join([f"mimeType='{mt}'" for mt in self.SUPPORTED_MIME_TYPES])
            query_parts.append(f'({mime_query})')

            # Not trashed
            query_parts.append('trashed=false')

            # Custom filter
            if query_filter:
                query_parts.append(query_filter)

            query = ' and '.join(query_parts)

            # List files
            results = self.service.files().list(
                q=query,
                pageSize=page_size,
                fields="nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, parents, owners)"
            ).execute()

            files = results.get('files', [])
            logger.info(f'Found {len(files)} files in Drive')

            return files

        except Exception as e:
            logger.error(f'Error listing Drive files: {e}')
            raise

    def search_invoice_files(self, folder_id: Optional[str] = None,
                            modified_after: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Search for invoice files based on naming patterns

        Args:
            folder_id: Folder to search
            modified_after: Only return files modified after this date

        Returns:
            List of invoice file metadata
        """
        try:
            files = self.list_files(folder_id=folder_id)

            # Filter by invoice keywords in filename
            invoice_files = []
            for file in files:
                filename = file.get('name', '').lower()

                # Check if filename contains invoice keywords
                if any(keyword in filename for keyword in self.INVOICE_KEYWORDS):
                    # Check modification time
                    if modified_after:
                        modified_time = datetime.fromisoformat(
                            file.get('modifiedTime', '').replace('Z', '+00:00')
                        )
                        if modified_time <= modified_after:
                            continue

                    invoice_files.append(file)

            logger.info(f'Found {len(invoice_files)} potential invoice files')
            return invoice_files

        except Exception as e:
            logger.error(f'Error searching invoice files: {e}')
            raise

    def download_file(self, file_id: str) -> bytes:
        """
        Download file content from Drive

        Args:
            file_id: Google Drive file ID

        Returns:
            File content as bytes
        """
        if not self.service:
            raise Exception('Drive service not initialized')

        try:
            request = self.service.files().get_media(fileId=file_id)
            file_buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(file_buffer, request)

            done = False
            while not done:
                status, done = downloader.next_chunk()
                if status:
                    logger.info(f'Download progress: {int(status.progress() * 100)}%')

            file_buffer.seek(0)
            content = file_buffer.read()

            logger.info(f'Downloaded file {file_id} ({len(content)} bytes)')
            return content

        except Exception as e:
            logger.error(f'Error downloading file {file_id}: {e}')
            raise

    def get_file_metadata(self, file_id: str) -> Dict[str, Any]:
        """
        Get file metadata

        Args:
            file_id: Google Drive file ID

        Returns:
            File metadata dictionary
        """
        if not self.service:
            raise Exception('Drive service not initialized')

        try:
            file_metadata = self.service.files().get(
                fileId=file_id,
                fields="id, name, mimeType, size, createdTime, modifiedTime, parents, owners, webViewLink"
            ).execute()

            return file_metadata

        except Exception as e:
            logger.error(f'Error getting file metadata: {e}')
            raise

    def watch_folder(self, folder_id: str, webhook_url: str,
                     channel_id: str, token: Optional[str] = None) -> Dict[str, Any]:
        """
        Set up push notifications for folder changes

        Args:
            folder_id: Folder to watch
            webhook_url: Webhook URL to receive notifications
            channel_id: Unique channel ID
            token: Optional verification token

        Returns:
            Watch response with channel information
        """
        if not self.service:
            raise Exception('Drive service not initialized')

        try:
            body = {
                'id': channel_id,
                'type': 'web_hook',
                'address': webhook_url
            }

            if token:
                body['token'] = token

            watch_response = self.service.files().watch(
                fileId=folder_id,
                body=body
            ).execute()

            logger.info(f'Set up watch for folder {folder_id}')
            return watch_response

        except Exception as e:
            logger.error(f'Error setting up folder watch: {e}')
            raise

    def stop_watch(self, channel_id: str, resource_id: str):
        """
        Stop push notifications for a channel

        Args:
            channel_id: Channel ID from watch response
            resource_id: Resource ID from watch response
        """
        if not self.service:
            raise Exception('Drive service not initialized')

        try:
            self.service.channels().stop(
                body={
                    'id': channel_id,
                    'resourceId': resource_id
                }
            ).execute()

            logger.info(f'Stopped watch for channel {channel_id}')

        except Exception as e:
            logger.error(f'Error stopping watch: {e}')
            raise


# Helper functions for FastAPI integration
def create_drive_service(credentials_dict: Dict[str, Any]) -> DriveIntegrationService:
    """
    Create Drive service from credentials dictionary

    Args:
        credentials_dict: OAuth2 credentials

    Returns:
        DriveIntegrationService instance
    """
    return DriveIntegrationService(credentials=credentials_dict)


def is_invoice_file(filename: str) -> bool:
    """
    Check if filename suggests it's an invoice

    Args:
        filename: File name to check

    Returns:
        True if likely an invoice
    """
    filename_lower = filename.lower()
    return any(keyword in filename_lower for keyword in DriveIntegrationService.INVOICE_KEYWORDS)
