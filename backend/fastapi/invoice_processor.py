"""
Invoice OCR and Data Extraction Service
Handles OCR processing and AI-powered data extraction from invoice PDFs/images
"""

import os
import io
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from pathlib import Path
import tempfile

# PDF and Image processing
from PIL import Image
import pytesseract
from pdf2image import convert_from_path, convert_from_bytes
import PyPDF2

# Google Generative AI
import google.generativeai as genai

# Supabase client
from supabase import create_client, Client

logger = logging.getLogger(__name__)


class InvoiceProcessor:
    """Processes invoices using OCR and AI extraction"""

    def __init__(self, supabase_client: Client, gemini_api_key: str):
        self.supabase = supabase_client
        self.gemini_api_key = gemini_api_key

        # Configure Gemini
        if gemini_api_key and gemini_api_key != 'your-gemini-api-key':
            genai.configure(api_key=gemini_api_key)
            # Use gemini-2.5-flash model (latest and fastest)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
            self.gemini_enabled = True
            logger.info("Gemini AI initialized for invoice extraction with gemini-2.5-flash")
        else:
            self.gemini_enabled = False
            logger.warning("Gemini API key not configured - using basic OCR only")

    async def process_invoice(self, invoice_id: str, user_id: str) -> Dict[str, Any]:
        """
        Main processing pipeline for an invoice

        Steps:
        1. Download invoice file from Supabase storage
        2. Extract text using OCR
        3. Use AI to extract structured data
        4. Update database with extracted information

        Args:
            invoice_id: UUID of the invoice to process
            user_id: UUID of the user who owns the invoice

        Returns:
            Dictionary with processing results
        """
        try:
            logger.info(f"Starting invoice processing for invoice_id={invoice_id}")

            # Step 1: Get invoice record from database
            invoice_resp = self.supabase.table('invoices').select('*').eq('id', invoice_id).execute()

            if not invoice_resp.data or len(invoice_resp.data) == 0:
                raise Exception(f"Invoice {invoice_id} not found")

            invoice = invoice_resp.data[0]
            file_path = invoice.get('file_path')

            if not file_path:
                raise Exception(f"Invoice {invoice_id} has no file_path")

            logger.info(f"Invoice file path: {file_path}")

            # Step 2: Download file from Supabase Storage
            file_bytes = await self._download_file_from_storage(file_path)

            # Step 3: Extract text using OCR
            extracted_text = await self._extract_text_from_file(file_bytes, file_path)

            if not extracted_text or len(extracted_text.strip()) < 10:
                raise Exception("OCR failed to extract meaningful text from invoice")

            logger.info(f"Extracted {len(extracted_text)} characters of text")

            # Step 4: Use AI to extract structured data
            structured_data = await self._extract_invoice_data(extracted_text)

            # Step 5: Update database with extracted data
            update_data = {
                'status': 'completed',
                'processed_at': datetime.utcnow().isoformat() + 'Z',
                'vendor_name': structured_data.get('vendor_name'),
                'invoice_number': structured_data.get('invoice_number'),
                'invoice_date': structured_data.get('invoice_date'),
                'due_date': structured_data.get('due_date'),
                'total_amount': structured_data.get('total_amount'),
                'subtotal': structured_data.get('subtotal'),
                'tax_amount': structured_data.get('tax_amount'),
                'vat_amount': structured_data.get('vat_amount'),
                'currency': structured_data.get('currency', 'USD'),
                'customer_name': structured_data.get('customer_name'),
                'customer_address': structured_data.get('customer_address'),
                'vendor_address': structured_data.get('vendor_address'),
                'payment_terms': structured_data.get('payment_terms'),
                'payment_method': structured_data.get('payment_method'),
                'po_number': structured_data.get('po_number'),
                'line_items': structured_data.get('line_items', []),
                'notes': structured_data.get('notes'),
                'vat_number': structured_data.get('vat_number'),
                'trn': structured_data.get('trn'),
            }

            # Remove None values
            update_data = {k: v for k, v in update_data.items() if v is not None}

            # Update invoice in database
            self.supabase.table('invoices').update(update_data).eq('id', invoice_id).execute()

            logger.info(f"Successfully processed invoice {invoice_id}")

            return {
                'success': True,
                'invoice_id': invoice_id,
                'extracted_data': structured_data,
                'text_length': len(extracted_text)
            }

        except Exception as e:
            logger.error(f"Error processing invoice {invoice_id}: {str(e)}", exc_info=True)

            # Update invoice with error status
            self.supabase.table('invoices').update({
                'status': 'failed',
                'error_message': str(e),
                'processed_at': datetime.utcnow().isoformat() + 'Z'
            }).eq('id', invoice_id).execute()

            return {
                'success': False,
                'invoice_id': invoice_id,
                'error': str(e)
            }

    async def _download_file_from_storage(self, file_path: str) -> bytes:
        """Download file from Supabase Storage"""
        try:
            # Remove leading slash if present
            clean_path = file_path.lstrip('/')

            # Download from Supabase storage bucket 'invoices'
            response = self.supabase.storage.from_('invoices').download(clean_path)

            if not response:
                raise Exception(f"Failed to download file from storage: {file_path}")

            logger.info(f"Downloaded file from storage: {file_path} ({len(response)} bytes)")
            return response

        except Exception as e:
            logger.error(f"Error downloading file {file_path}: {str(e)}")
            raise

    async def _extract_text_from_file(self, file_bytes: bytes, file_path: str) -> str:
        """Extract text from PDF or image file using OCR"""
        try:
            file_extension = Path(file_path).suffix.lower()

            if file_extension == '.pdf':
                return await self._extract_text_from_pdf(file_bytes)
            elif file_extension in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
                return await self._extract_text_from_image(file_bytes)
            else:
                raise Exception(f"Unsupported file type: {file_extension}")

        except Exception as e:
            logger.error(f"Error extracting text from file: {str(e)}")
            raise

    async def _extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        """Extract text from PDF using PyPDF2 and OCR fallback"""
        try:
            # First try to extract text directly from PDF
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
            text = ""

            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"

            # If we got meaningful text, return it
            if text and len(text.strip()) > 50:
                logger.info("Extracted text directly from PDF")
                return text

            # Otherwise, fall back to OCR
            logger.info("PDF has no extractable text, using OCR")

            # Convert PDF to images and OCR each page
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
                tmp_file.write(pdf_bytes)
                tmp_file.flush()
                tmp_path = tmp_file.name

            try:
                # Convert PDF pages to images
                images = convert_from_path(tmp_path, dpi=300)

                ocr_text = ""
                for i, image in enumerate(images):
                    logger.info(f"OCR processing page {i+1}/{len(images)}")
                    page_text = pytesseract.image_to_string(image, lang='eng')
                    ocr_text += page_text + "\n"

                return ocr_text

            finally:
                # Clean up temp file
                os.unlink(tmp_path)

        except Exception as e:
            logger.error(f"Error extracting text from PDF: {str(e)}")
            raise

    async def _extract_text_from_image(self, image_bytes: bytes) -> str:
        """Extract text from image using Tesseract OCR"""
        try:
            # Open image
            image = Image.open(io.BytesIO(image_bytes))

            # Perform OCR
            text = pytesseract.image_to_string(image, lang='eng')

            logger.info(f"OCR extracted {len(text)} characters from image")
            return text

        except Exception as e:
            logger.error(f"Error extracting text from image: {str(e)}")
            raise

    async def _extract_invoice_data(self, text: str) -> Dict[str, Any]:
        """Extract structured invoice data using AI"""

        if self.gemini_enabled:
            return await self._extract_with_gemini(text)
        else:
            return await self._extract_with_regex(text)

    async def _extract_with_gemini(self, text: str) -> Dict[str, Any]:
        """Use Gemini AI to extract structured data from invoice text"""
        try:
            prompt = f"""
You are an expert invoice data extraction assistant. Extract the following information from this invoice text.
Return your response as a valid JSON object with these exact fields (use null for missing values):

{{
  "vendor_name": "Company or person issuing the invoice",
  "invoice_number": "Invoice number or ID",
  "invoice_date": "Invoice date in YYYY-MM-DD format",
  "due_date": "Payment due date in YYYY-MM-DD format",
  "total_amount": "Total amount as a number (no currency symbols)",
  "subtotal": "Subtotal before tax as a number",
  "tax_amount": "Tax/VAT amount as a number",
  "vat_amount": "VAT amount as a number (same as tax_amount if VAT is mentioned)",
  "currency": "Currency code (USD, EUR, GBP, AED, SAR, etc.)",
  "customer_name": "Customer/buyer name",
  "customer_address": "Customer address",
  "vendor_address": "Vendor/seller address",
  "payment_terms": "Payment terms (e.g., 'Net 30', 'Due on receipt')",
  "payment_method": "Payment method if mentioned",
  "po_number": "Purchase order number if present",
  "vat_number": "VAT registration number",
  "trn": "Tax Registration Number (TRN) for UAE invoices",
  "notes": "Any notes or special instructions",
  "line_items": [
    {{
      "description": "Item description",
      "quantity": "Quantity as number",
      "unit_price": "Unit price as number",
      "amount": "Line total as number"
    }}
  ]
}}

INVOICE TEXT:
{text}

Return ONLY the JSON object, no other text.
"""

            response = self.model.generate_content(prompt)
            response_text = response.text.strip()

            # Remove markdown code blocks if present
            if response_text.startswith('```'):
                response_text = response_text.split('```')[1]
                if response_text.startswith('json'):
                    response_text = response_text[4:]
                response_text = response_text.strip()

            # Parse JSON response
            extracted_data = json.loads(response_text)

            logger.info("Successfully extracted invoice data using Gemini AI")
            return extracted_data

        except Exception as e:
            logger.error(f"Error extracting data with Gemini: {str(e)}")
            # Fall back to regex extraction
            return await self._extract_with_regex(text)

    async def _extract_with_regex(self, text: str) -> Dict[str, Any]:
        """Fallback: Extract basic data using regex patterns"""
        import re

        extracted = {
            'vendor_name': None,
            'invoice_number': None,
            'invoice_date': None,
            'total_amount': None,
            'currency': 'USD'
        }

        # Try to find invoice number
        invoice_patterns = [
            r'Invoice\s*#?\s*:?\s*([A-Z0-9-]+)',
            r'Invoice\s*Number\s*:?\s*([A-Z0-9-]+)',
            r'INV[-\s]*([A-Z0-9-]+)',
        ]
        for pattern in invoice_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                extracted['invoice_number'] = match.group(1)
                break

        # Try to find dates
        date_patterns = [
            r'Date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
            r'Invoice\s*Date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
            r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        ]
        for pattern in date_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                extracted['invoice_date'] = match.group(1)
                break

        # Try to find total amount
        amount_patterns = [
            r'Total\s*:?\s*\$?\s*([\d,]+\.?\d*)',
            r'Amount\s*Due\s*:?\s*\$?\s*([\d,]+\.?\d*)',
            r'Grand\s*Total\s*:?\s*\$?\s*([\d,]+\.?\d*)',
        ]
        for pattern in amount_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amount_str = match.group(1).replace(',', '')
                try:
                    extracted['total_amount'] = float(amount_str)
                except:
                    pass
                break

        logger.info("Extracted basic invoice data using regex (fallback method)")
        return extracted


# Global processor instance
_processor_instance = None


def get_invoice_processor(supabase_client: Client, gemini_api_key: str) -> InvoiceProcessor:
    """Get or create the invoice processor singleton"""
    global _processor_instance

    if _processor_instance is None:
        _processor_instance = InvoiceProcessor(supabase_client, gemini_api_key)

    return _processor_instance
