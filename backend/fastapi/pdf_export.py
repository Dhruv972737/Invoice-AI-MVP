"""
PDF Export Service with ReportLab Styling
Generates professional invoice PDFs and reports
"""
import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak
from reportlab.platypus.frames import Frame
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate
from reportlab.pdfgen import canvas

logger = logging.getLogger(__name__)


class PDFExportService:
    """
    Professional PDF export service for invoices and reports
    """

    # Color scheme
    COLORS = {
        'primary': colors.HexColor('#2563eb'),  # Blue
        'secondary': colors.HexColor('#64748b'),  # Slate
        'success': colors.HexColor('#10b981'),  # Green
        'danger': colors.HexColor('#ef4444'),  # Red
        'warning': colors.HexColor('#f59e0b'),  # Amber
        'dark': colors.HexColor('#1e293b'),
        'light': colors.HexColor('#f8fafc'),
        'border': colors.HexColor('#e2e8f0')
    }

    def __init__(self, page_size=A4, logo_path: Optional[str] = None):
        """
        Initialize PDF export service

        Args:
            page_size: Page size (A4 or letter)
            logo_path: Path to company logo image
        """
        self.page_size = page_size
        self.width, self.height = page_size
        self.logo_path = logo_path
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

        logger.info('PDF export service initialized')

    def _setup_custom_styles(self):
        """Setup custom paragraph styles"""
        # Title style
        self.styles.add(ParagraphStyle(
            name='InvoiceTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=self.COLORS['primary'],
            spaceAfter=12,
            alignment=TA_LEFT,
            fontName='Helvetica-Bold'
        ))

        # Subtitle style
        self.styles.add(ParagraphStyle(
            name='InvoiceSubtitle',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=self.COLORS['secondary'],
            spaceAfter=6,
            alignment=TA_LEFT
        ))

        # Invoice header
        self.styles.add(ParagraphStyle(
            name='InvoiceHeader',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=self.COLORS['dark'],
            spaceAfter=3
        ))

        # Body text
        self.styles.add(ParagraphStyle(
            name='InvoiceBody',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=self.COLORS['dark'],
            alignment=TA_LEFT
        ))

        # Small text
        self.styles.add(ParagraphStyle(
            name='InvoiceSmall',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=self.COLORS['secondary'],
            alignment=TA_LEFT
        ))

        # Right aligned
        self.styles.add(ParagraphStyle(
            name='InvoiceRight',
            parent=self.styles['Normal'],
            fontSize=10,
            alignment=TA_RIGHT
        ))

        # Center aligned
        self.styles.add(ParagraphStyle(
            name='InvoiceCenter',
            parent=self.styles['Normal'],
            fontSize=10,
            alignment=TA_CENTER
        ))

    def generate_invoice_pdf(self, invoice_data: Dict[str, Any],
                            company_info: Optional[Dict[str, Any]] = None) -> bytes:
        """
        Generate professional invoice PDF

        Args:
            invoice_data: Invoice data
            company_info: Company information (name, address, logo, etc.)

        Returns:
            PDF file as bytes
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=self.page_size,
            rightMargin=30,
            leftMargin=30,
            topMargin=30,
            bottomMargin=30
        )

        # Build content
        story = []

        # Header section
        story.extend(self._build_invoice_header(invoice_data, company_info))
        story.append(Spacer(1, 20))

        # Invoice details
        story.extend(self._build_invoice_details(invoice_data))
        story.append(Spacer(1, 20))

        # Line items table
        story.extend(self._build_line_items_table(invoice_data))
        story.append(Spacer(1, 20))

        # Totals section
        story.extend(self._build_totals_section(invoice_data))
        story.append(Spacer(1, 20))

        # Payment info
        story.extend(self._build_payment_info(invoice_data))
        story.append(Spacer(1, 20))

        # Notes and terms
        if invoice_data.get('notes') or invoice_data.get('terms'):
            story.extend(self._build_notes_section(invoice_data))

        # Footer
        story.append(Spacer(1, 20))
        story.extend(self._build_footer(invoice_data))

        # Build PDF
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        logger.info(f'Generated invoice PDF: {invoice_data.get("invoice_number")}')
        return pdf_bytes

    def _build_invoice_header(self, invoice_data: Dict[str, Any],
                              company_info: Optional[Dict[str, Any]]) -> List:
        """Build invoice header with logo and company info"""
        elements = []

        # Create header table with logo and company info
        header_data = []

        # Company info (left side)
        company_name = company_info.get('name', 'Invoice AI') if company_info else 'Invoice AI'
        company_address = company_info.get('address', '') if company_info else ''
        company_phone = company_info.get('phone', '') if company_info else ''
        company_email = company_info.get('email', '') if company_info else ''

        left_cell = [
            Paragraph(f'<b>{company_name}</b>', self.styles['InvoiceTitle']),
            Paragraph(company_address, self.styles['InvoiceSmall']),
            Paragraph(f'Phone: {company_phone}', self.styles['InvoiceSmall']),
            Paragraph(f'Email: {company_email}', self.styles['InvoiceSmall'])
        ]

        # Invoice title (right side)
        right_cell = [
            Paragraph('<b>INVOICE</b>', self.styles['InvoiceTitle']),
            Paragraph(f'Invoice #: {invoice_data.get("invoice_number", "N/A")}', self.styles['InvoiceHeader']),
            Paragraph(f'Date: {invoice_data.get("invoice_date", "N/A")}', self.styles['InvoiceHeader']),
            Paragraph(f'Due Date: {invoice_data.get("due_date", "N/A")}', self.styles['InvoiceHeader'])
        ]

        header_table = Table(
            [[left_cell, right_cell]],
            colWidths=[self.width * 0.5, self.width * 0.4]
        )

        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT')
        ]))

        elements.append(header_table)

        # Horizontal line
        elements.append(Spacer(1, 10))
        line_table = Table([['']], colWidths=[self.width - 60])
        line_table.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, 0), 2, self.COLORS['primary'])
        ]))
        elements.append(line_table)

        return elements

    def _build_invoice_details(self, invoice_data: Dict[str, Any]) -> List:
        """Build invoice details section"""
        elements = []

        # Vendor and customer info
        vendor_name = invoice_data.get('vendor_name', 'N/A')
        vendor_address = invoice_data.get('vendor_address', '')
        customer_name = invoice_data.get('customer_name', 'N/A')
        customer_address = invoice_data.get('customer_address', '')

        details_data = [
            [
                Paragraph('<b>From:</b>', self.styles['InvoiceBody']),
                Paragraph('<b>To:</b>', self.styles['InvoiceBody'])
            ],
            [
                Paragraph(vendor_name, self.styles['InvoiceBody']),
                Paragraph(customer_name, self.styles['InvoiceBody'])
            ],
            [
                Paragraph(vendor_address, self.styles['InvoiceSmall']),
                Paragraph(customer_address, self.styles['InvoiceSmall'])
            ]
        ]

        details_table = Table(details_data, colWidths=[self.width * 0.45, self.width * 0.45])
        details_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BACKGROUND', (0, 0), (-1, 0), self.COLORS['light']),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('BOX', (0, 0), (-1, -1), 1, self.COLORS['border'])
        ]))

        elements.append(details_table)
        return elements

    def _build_line_items_table(self, invoice_data: Dict[str, Any]) -> List:
        """Build line items table"""
        elements = []

        # Table header
        data = [[
            Paragraph('<b>Description</b>', self.styles['InvoiceBody']),
            Paragraph('<b>Quantity</b>', self.styles['InvoiceCenter']),
            Paragraph('<b>Unit Price</b>', self.styles['InvoiceRight']),
            Paragraph('<b>Amount</b>', self.styles['InvoiceRight'])
        ]]

        # Line items
        line_items = invoice_data.get('line_items', [])
        if not line_items:
            # If no line items, show single row with total
            data.append([
                Paragraph('Invoice Total', self.styles['InvoiceBody']),
                '',
                '',
                Paragraph(f'${invoice_data.get("total_amount", 0):.2f}', self.styles['InvoiceRight'])
            ])
        else:
            for item in line_items:
                data.append([
                    Paragraph(item.get('description', 'N/A'), self.styles['InvoiceBody']),
                    Paragraph(str(item.get('quantity', 1)), self.styles['InvoiceCenter']),
                    Paragraph(f'${item.get("unit_price", 0):.2f}', self.styles['InvoiceRight']),
                    Paragraph(f'${item.get("amount", 0):.2f}', self.styles['InvoiceRight'])
                ])

        # Create table
        table = Table(data, colWidths=[
            self.width * 0.4,
            self.width * 0.15,
            self.width * 0.2,
            self.width * 0.2
        ])

        table.setStyle(TableStyle([
            # Header styling
            ('BACKGROUND', (0, 0), (-1, 0), self.COLORS['primary']),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('PADDING', (0, 0), (-1, 0), 10),

            # Body styling
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), self.COLORS['dark']),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('PADDING', (0, 1), (-1, -1), 8),

            # Borders
            ('GRID', (0, 0), (-1, -1), 0.5, self.COLORS['border']),
            ('BOX', (0, 0), (-1, -1), 1, self.COLORS['border']),

            # Alignment
            ('ALIGN', (1, 1), (1, -1), 'CENTER'),
            ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
        ]))

        elements.append(table)
        return elements

    def _build_totals_section(self, invoice_data: Dict[str, Any]) -> List:
        """Build totals section"""
        elements = []

        subtotal = invoice_data.get('subtotal', invoice_data.get('total_amount', 0))
        tax_amount = invoice_data.get('tax_amount', 0)
        discount = invoice_data.get('discount', 0)
        total = invoice_data.get('total_amount', 0)

        # Build totals table (right-aligned)
        totals_data = []

        if subtotal > 0:
            totals_data.append([
                Paragraph('Subtotal:', self.styles['InvoiceBody']),
                Paragraph(f'${subtotal:.2f}', self.styles['InvoiceRight'])
            ])

        if discount > 0:
            totals_data.append([
                Paragraph('Discount:', self.styles['InvoiceBody']),
                Paragraph(f'-${discount:.2f}', self.styles['InvoiceRight'])
            ])

        if tax_amount > 0:
            totals_data.append([
                Paragraph('Tax:', self.styles['InvoiceBody']),
                Paragraph(f'${tax_amount:.2f}', self.styles['InvoiceRight'])
            ])

        totals_data.append([
            Paragraph('<b>Total:</b>', self.styles['InvoiceBody']),
            Paragraph(f'<b>${total:.2f}</b>', self.styles['InvoiceRight'])
        ])

        # Create table (right-aligned on page)
        totals_table = Table(totals_data, colWidths=[self.width * 0.3, self.width * 0.2])
        totals_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('LINEABOVE', (0, -1), (-1, -1), 2, self.COLORS['primary']),
            ('BACKGROUND', (0, -1), (-1, -1), self.COLORS['light'])
        ]))

        # Wrapper table to position on right
        wrapper = Table([[' ', totals_table]], colWidths=[self.width * 0.45, self.width * 0.5])
        wrapper.setStyle(TableStyle([
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP')
        ]))

        elements.append(wrapper)
        return elements

    def _build_payment_info(self, invoice_data: Dict[str, Any]) -> List:
        """Build payment information section"""
        elements = []

        payment_terms = invoice_data.get('payment_terms', 'Net 30')
        payment_method = invoice_data.get('payment_method', 'Bank Transfer')

        payment_data = [
            [Paragraph('<b>Payment Information</b>', self.styles['InvoiceSubtitle'])]
        ]

        if payment_terms:
            payment_data.append([
                Paragraph(f'Payment Terms: {payment_terms}', self.styles['InvoiceBody'])
            ])

        if payment_method:
            payment_data.append([
                Paragraph(f'Payment Method: {payment_method}', self.styles['InvoiceBody'])
            ])

        payment_table = Table(payment_data, colWidths=[self.width - 60])
        payment_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.COLORS['light']),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('BOX', (0, 0), (-1, -1), 1, self.COLORS['border'])
        ]))

        elements.append(payment_table)
        return elements

    def _build_notes_section(self, invoice_data: Dict[str, Any]) -> List:
        """Build notes and terms section"""
        elements = []

        notes = invoice_data.get('notes', '')
        terms = invoice_data.get('terms', '')

        if notes:
            elements.append(Paragraph('<b>Notes:</b>', self.styles['InvoiceSubtitle']))
            elements.append(Paragraph(notes, self.styles['InvoiceBody']))
            elements.append(Spacer(1, 10))

        if terms:
            elements.append(Paragraph('<b>Terms and Conditions:</b>', self.styles['InvoiceSubtitle']))
            elements.append(Paragraph(terms, self.styles['InvoiceSmall']))

        return elements

    def _build_footer(self, invoice_data: Dict[str, Any]) -> List:
        """Build invoice footer"""
        elements = []

        footer_text = f'Generated by Invoice AI on {datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}'

        footer = Paragraph(footer_text, self.styles['InvoiceSmall'])
        footer_table = Table([[footer]], colWidths=[self.width - 60])
        footer_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ('TEXTCOLOR', (0, 0), (0, 0), self.COLORS['secondary'])
        ]))

        elements.append(footer_table)
        return elements

    def generate_report_pdf(self, report_data: Dict[str, Any],
                           report_type: str = 'summary') -> bytes:
        """
        Generate report PDF (analytics, tax summary, etc.)

        Args:
            report_data: Report data
            report_type: Type of report (summary, analytics, tax)

        Returns:
            PDF file as bytes
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=self.page_size,
            rightMargin=30,
            leftMargin=30,
            topMargin=30,
            bottomMargin=30
        )

        story = []

        # Title
        title = report_data.get('title', 'Invoice AI Report')
        story.append(Paragraph(title, self.styles['InvoiceTitle']))
        story.append(Spacer(1, 20))

        # Summary stats
        if report_data.get('summary'):
            story.extend(self._build_summary_table(report_data['summary']))
            story.append(Spacer(1, 20))

        # Detailed data
        if report_data.get('data'):
            story.extend(self._build_data_table(report_data['data']))

        # Footer
        story.append(Spacer(1, 20))
        story.extend(self._build_footer({}))

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        logger.info(f'Generated {report_type} report PDF')
        return pdf_bytes

    def _build_summary_table(self, summary: Dict[str, Any]) -> List:
        """Build summary statistics table"""
        elements = []

        data = [[
            Paragraph('<b>Metric</b>', self.styles['InvoiceBody']),
            Paragraph('<b>Value</b>', self.styles['InvoiceRight'])
        ]]

        for key, value in summary.items():
            data.append([
                Paragraph(key.replace('_', ' ').title(), self.styles['InvoiceBody']),
                Paragraph(str(value), self.styles['InvoiceRight'])
            ])

        table = Table(data, colWidths=[self.width * 0.6, self.width * 0.3])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.COLORS['primary']),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, self.COLORS['border']),
            ('BOX', (0, 0), (-1, -1), 1, self.COLORS['border']),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT')
        ]))

        elements.append(table)
        return elements

    def _build_data_table(self, data: List[Dict[str, Any]]) -> List:
        """Build generic data table"""
        elements = []

        if not data:
            return elements

        # Get headers from first row
        headers = list(data[0].keys())

        # Build table data
        table_data = [[Paragraph(f'<b>{h}</b>', self.styles['InvoiceBody']) for h in headers]]

        for row in data:
            table_data.append([
                Paragraph(str(row.get(h, '')), self.styles['InvoiceBody'])
                for h in headers
            ])

        # Calculate column widths
        col_width = (self.width - 60) / len(headers)
        col_widths = [col_width] * len(headers)

        table = Table(table_data, colWidths=col_widths)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.COLORS['primary']),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, self.COLORS['border']),
            ('BOX', (0, 0), (-1, -1), 1, self.COLORS['border'])
        ]))

        elements.append(table)
        return elements


# Helper function
def create_pdf_service(page_size=A4, logo_path: Optional[str] = None) -> PDFExportService:
    """
    Create PDF export service instance

    Args:
        page_size: Page size
        logo_path: Company logo path

    Returns:
        PDFExportService instance
    """
    return PDFExportService(page_size=page_size, logo_path=logo_path)
