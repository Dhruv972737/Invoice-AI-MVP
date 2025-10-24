"""
Tax Compliance Integration for Invoice AI
Supports ZATCA (Saudi Arabia), UAE FTA, and VIES (EU) validation
"""
import os
import logging
import hashlib
import hmac
import base64
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional, List
from datetime import datetime
import httpx

logger = logging.getLogger(__name__)


class TaxComplianceService:
    """
    Multi-region tax compliance validation service
    """

    # ZATCA (Saudi Arabia) endpoints
    ZATCA_SANDBOX_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal'
    ZATCA_PRODUCTION_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core'

    # UAE FTA endpoints
    UAE_FTA_SANDBOX_URL = 'https://preprod.fta.ae/einvoicing/api'
    UAE_FTA_PRODUCTION_URL = 'https://fta.ae/einvoicing/api'

    # VIES (EU) endpoint
    VIES_URL = 'http://ec.europa.eu/taxation_customs/vies/services/checkVatService'

    # Tax rates by region
    TAX_RATES = {
        'SA': {'vat': 0.15, 'name': 'VAT'},  # Saudi Arabia
        'AE': {'vat': 0.05, 'name': 'VAT'},  # UAE
        'DE': {'vat': 0.19, 'reduced': 0.07, 'name': 'MwSt'},  # Germany
        'GB': {'vat': 0.20, 'reduced': 0.05, 'name': 'VAT'},  # UK
        'US': {'sales_tax': 0.08, 'name': 'Sales Tax'}  # US (varies by state)
    }

    def __init__(self, region: str = 'SA', mode: str = 'sandbox'):
        """
        Initialize tax compliance service

        Args:
            region: Tax region (SA, AE, EU, etc.)
            mode: 'sandbox' or 'production'
        """
        self.region = region.upper()
        self.mode = mode
        self.client = httpx.AsyncClient(timeout=30.0)

        # Region-specific configuration
        self.zatca_api_key = os.getenv('ZATCA_API_KEY')
        self.zatca_secret = os.getenv('ZATCA_SECRET')
        self.uae_api_key = os.getenv('UAE_FTA_API_KEY')
        self.uae_secret = os.getenv('UAE_FTA_SECRET')

        logger.info(f'Tax compliance service initialized for region: {region}, mode: {mode}')

    async def validate_vat_number(self, vat_number: str, country_code: str) -> Dict[str, Any]:
        """
        Validate VAT number through appropriate service

        Args:
            vat_number: VAT number to validate
            country_code: ISO country code (SA, AE, DE, etc.)

        Returns:
            Validation result
        """
        country_code = country_code.upper()

        if country_code == 'SA':
            return await self._validate_zatca_vat(vat_number)
        elif country_code == 'AE':
            return await self._validate_uae_trn(vat_number)
        elif country_code in ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PL', 'SE', 'FI']:
            return await self._validate_vies_vat(vat_number, country_code)
        else:
            return {
                'valid': False,
                'error': f'VAT validation not supported for country: {country_code}'
            }

    async def _validate_zatca_vat(self, vat_number: str) -> Dict[str, Any]:
        """
        Validate Saudi Arabian VAT number through ZATCA

        Args:
            vat_number: 15-digit VAT number

        Returns:
            Validation result
        """
        # ZATCA VAT format: 15 digits
        if not vat_number.isdigit() or len(vat_number) != 15:
            return {
                'valid': False,
                'error': 'Invalid ZATCA VAT format (must be 15 digits)',
                'region': 'SA'
            }

        try:
            url = self.ZATCA_SANDBOX_URL if self.mode == 'sandbox' else self.ZATCA_PRODUCTION_URL
            url += '/compliance/validate-vat'

            headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.zatca_api_key}'
            }

            payload = {
                'vat_number': vat_number
            }

            response = await self.client.post(url, json=payload, headers=headers)

            if response.status_code == 200:
                data = response.json()
                return {
                    'valid': data.get('valid', False),
                    'vat_number': vat_number,
                    'region': 'SA',
                    'business_name': data.get('name'),
                    'registration_date': data.get('registration_date'),
                    'status': data.get('status')
                }
            else:
                return {
                    'valid': False,
                    'error': f'ZATCA validation failed: {response.status_code}',
                    'region': 'SA'
                }

        except Exception as e:
            logger.error(f'Error validating ZATCA VAT: {e}')
            return {
                'valid': False,
                'error': str(e),
                'region': 'SA'
            }

    async def _validate_uae_trn(self, trn: str) -> Dict[str, Any]:
        """
        Validate UAE Tax Registration Number (TRN)

        Args:
            trn: 15-digit TRN

        Returns:
            Validation result
        """
        # UAE TRN format: 15 digits
        if not trn.isdigit() or len(trn) != 15:
            return {
                'valid': False,
                'error': 'Invalid UAE TRN format (must be 15 digits)',
                'region': 'AE'
            }

        try:
            url = self.UAE_FTA_SANDBOX_URL if self.mode == 'sandbox' else self.UAE_FTA_PRODUCTION_URL
            url += '/validate/trn'

            headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-API-Key': self.uae_api_key
            }

            payload = {
                'trn': trn
            }

            response = await self.client.post(url, json=payload, headers=headers)

            if response.status_code == 200:
                data = response.json()
                return {
                    'valid': data.get('valid', False),
                    'trn': trn,
                    'region': 'AE',
                    'business_name': data.get('taxpayer_name'),
                    'registration_date': data.get('registration_date'),
                    'status': data.get('status')
                }
            else:
                return {
                    'valid': False,
                    'error': f'UAE FTA validation failed: {response.status_code}',
                    'region': 'AE'
                }

        except Exception as e:
            logger.error(f'Error validating UAE TRN: {e}')
            return {
                'valid': False,
                'error': str(e),
                'region': 'AE'
            }

    async def _validate_vies_vat(self, vat_number: str, country_code: str) -> Dict[str, Any]:
        """
        Validate EU VAT number through VIES

        Args:
            vat_number: VAT number (without country prefix)
            country_code: EU country code

        Returns:
            Validation result
        """
        try:
            # Build SOAP request
            soap_body = f'''<?xml version="1.0" encoding="UTF-8"?>
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                             xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
                <soapenv:Header/>
                <soapenv:Body>
                    <urn:checkVat>
                        <urn:countryCode>{country_code}</urn:countryCode>
                        <urn:vatNumber>{vat_number}</urn:vatNumber>
                    </urn:checkVat>
                </soapenv:Body>
            </soapenv:Envelope>'''

            headers = {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': ''
            }

            response = await self.client.post(self.VIES_URL, content=soap_body, headers=headers)

            if response.status_code == 200:
                # Parse SOAP response
                root = ET.fromstring(response.text)
                ns = {'ns': 'urn:ec.europa.eu:taxud:vies:services:checkVat:types'}

                valid = root.find('.//ns:valid', ns)
                name = root.find('.//ns:name', ns)
                address = root.find('.//ns:address', ns)

                is_valid = valid is not None and valid.text == 'true'

                return {
                    'valid': is_valid,
                    'vat_number': f'{country_code}{vat_number}',
                    'region': 'EU',
                    'country_code': country_code,
                    'business_name': name.text if name is not None else None,
                    'address': address.text if address is not None else None
                }
            else:
                return {
                    'valid': False,
                    'error': f'VIES validation failed: {response.status_code}',
                    'region': 'EU'
                }

        except Exception as e:
            logger.error(f'Error validating VIES VAT: {e}')
            return {
                'valid': False,
                'error': str(e),
                'region': 'EU'
            }

    async def submit_zatca_invoice(self, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submit invoice to ZATCA e-invoicing system

        Args:
            invoice_data: Invoice data in ZATCA format

        Returns:
            Submission result with clearance status
        """
        try:
            url = self.ZATCA_SANDBOX_URL if self.mode == 'sandbox' else self.ZATCA_PRODUCTION_URL
            url += '/invoices/clearance/single'

            # Generate invoice hash
            invoice_hash = self._generate_zatca_hash(invoice_data)

            # Build request
            headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.zatca_api_key}',
                'Accept-Language': 'en'
            }

            payload = {
                'invoice_hash': invoice_hash,
                'uuid': invoice_data.get('uuid'),
                'invoice': self._convert_to_zatca_format(invoice_data)
            }

            response = await self.client.post(url, json=payload, headers=headers)

            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'clearance_status': data.get('clearanceStatus'),
                    'cleared_invoice': data.get('clearedInvoice'),
                    'qr_code': data.get('qrCode'),
                    'validation_results': data.get('validationResults', {}),
                    'timestamp': datetime.utcnow().isoformat() + 'Z'
                }
            else:
                return {
                    'success': False,
                    'error': f'ZATCA submission failed: {response.status_code}',
                    'details': response.text
                }

        except Exception as e:
            logger.error(f'Error submitting ZATCA invoice: {e}')
            return {
                'success': False,
                'error': str(e)
            }

    async def submit_uae_invoice(self, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submit invoice to UAE FTA e-invoicing system

        Args:
            invoice_data: Invoice data in UAE format

        Returns:
            Submission result
        """
        try:
            url = self.UAE_FTA_SANDBOX_URL if self.mode == 'sandbox' else self.UAE_FTA_PRODUCTION_URL
            url += '/invoices/submit'

            headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-API-Key': self.uae_api_key
            }

            payload = self._convert_to_uae_format(invoice_data)

            response = await self.client.post(url, json=payload, headers=headers)

            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'submission_id': data.get('submission_id'),
                    'status': data.get('status'),
                    'invoice_reference': data.get('invoice_reference'),
                    'timestamp': datetime.utcnow().isoformat() + 'Z'
                }
            else:
                return {
                    'success': False,
                    'error': f'UAE FTA submission failed: {response.status_code}',
                    'details': response.text
                }

        except Exception as e:
            logger.error(f'Error submitting UAE invoice: {e}')
            return {
                'success': False,
                'error': str(e)
            }

    def calculate_tax(self, amount: float, country_code: str,
                     tax_type: str = 'vat') -> Dict[str, Any]:
        """
        Calculate tax for given amount and region

        Args:
            amount: Subtotal amount
            country_code: ISO country code
            tax_type: 'vat', 'reduced', 'sales_tax'

        Returns:
            Tax calculation results
        """
        country_code = country_code.upper()

        if country_code not in self.TAX_RATES:
            return {
                'error': f'Tax rates not configured for country: {country_code}',
                'subtotal': amount,
                'tax_amount': 0,
                'total': amount
            }

        rates = self.TAX_RATES[country_code]
        tax_rate = rates.get(tax_type, rates.get('vat', 0))

        tax_amount = amount * tax_rate
        total = amount + tax_amount

        return {
            'subtotal': round(amount, 2),
            'tax_rate': tax_rate,
            'tax_percentage': f'{tax_rate * 100}%',
            'tax_name': rates.get('name', 'Tax'),
            'tax_amount': round(tax_amount, 2),
            'total': round(total, 2),
            'country_code': country_code
        }

    def validate_invoice_compliance(self, invoice: Dict[str, Any],
                                    country_code: str) -> Dict[str, Any]:
        """
        Validate invoice compliance with regional requirements

        Args:
            invoice: Invoice data
            country_code: ISO country code

        Returns:
            Compliance validation results
        """
        country_code = country_code.upper()
        errors = []
        warnings = []

        # Common requirements
        required_fields = ['invoice_number', 'invoice_date', 'vendor_name',
                          'total_amount', 'tax_amount']

        for field in required_fields:
            if not invoice.get(field):
                errors.append(f'Missing required field: {field}')

        # Region-specific validation
        if country_code == 'SA':
            # ZATCA requirements
            if not invoice.get('vat_number'):
                errors.append('VAT number required for Saudi Arabia')

            # Check VAT number format
            vat = invoice.get('vat_number', '')
            if vat and (not vat.isdigit() or len(vat) != 15):
                errors.append('Invalid ZATCA VAT format (must be 15 digits)')

            # QR code required
            if not invoice.get('qr_code'):
                warnings.append('QR code recommended for ZATCA compliance')

        elif country_code == 'AE':
            # UAE FTA requirements
            if not invoice.get('trn'):
                errors.append('TRN (Tax Registration Number) required for UAE')

            # Check TRN format
            trn = invoice.get('trn', '')
            if trn and (not trn.isdigit() or len(trn) != 15):
                errors.append('Invalid UAE TRN format (must be 15 digits)')

        elif country_code in ['DE', 'FR', 'IT', 'ES']:
            # EU requirements
            if not invoice.get('vat_number'):
                errors.append(f'VAT number required for {country_code}')

            # Sequential numbering
            if not invoice.get('invoice_number'):
                errors.append('Sequential invoice numbering required in EU')

        # Tax calculation validation
        subtotal = float(invoice.get('subtotal', 0))
        tax_amount = float(invoice.get('tax_amount', 0))
        total = float(invoice.get('total_amount', 0))

        calculated = self.calculate_tax(subtotal, country_code)
        expected_tax = calculated['tax_amount']
        expected_total = calculated['total']

        # Allow 0.01 tolerance for rounding
        if abs(tax_amount - expected_tax) > 0.01:
            warnings.append(f'Tax amount mismatch: expected {expected_tax}, got {tax_amount}')

        if abs(total - expected_total) > 0.01:
            warnings.append(f'Total amount mismatch: expected {expected_total}, got {total}')

        is_compliant = len(errors) == 0

        return {
            'compliant': is_compliant,
            'country_code': country_code,
            'errors': errors,
            'warnings': warnings,
            'validation_date': datetime.utcnow().isoformat() + 'Z'
        }

    def _generate_zatca_hash(self, invoice_data: Dict[str, Any]) -> str:
        """Generate ZATCA-compliant invoice hash"""
        # Simplified hash generation (actual implementation more complex)
        hash_input = '|'.join([
            invoice_data.get('vendor_name', ''),
            invoice_data.get('vat_number', ''),
            invoice_data.get('invoice_date', ''),
            str(invoice_data.get('total_amount', '')),
            str(invoice_data.get('tax_amount', ''))
        ])

        return base64.b64encode(
            hashlib.sha256(hash_input.encode()).digest()
        ).decode()

    def _convert_to_zatca_format(self, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert invoice to ZATCA format"""
        # Simplified conversion
        return {
            'invoiceTypeCode': invoice_data.get('type_code', '388'),
            'id': invoice_data.get('invoice_number'),
            'issueDate': invoice_data.get('invoice_date'),
            'issueTime': invoice_data.get('invoice_time', '00:00:00'),
            'supplier': {
                'name': invoice_data.get('vendor_name'),
                'vatNumber': invoice_data.get('vat_number')
            },
            'totals': {
                'taxExclusiveAmount': invoice_data.get('subtotal'),
                'taxInclusiveAmount': invoice_data.get('total_amount'),
                'taxAmount': invoice_data.get('tax_amount')
            }
        }

    def _convert_to_uae_format(self, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert invoice to UAE FTA format"""
        return {
            'invoice_reference': invoice_data.get('invoice_number'),
            'issue_date': invoice_data.get('invoice_date'),
            'supplier': {
                'name': invoice_data.get('vendor_name'),
                'trn': invoice_data.get('trn')
            },
            'amounts': {
                'subtotal': invoice_data.get('subtotal'),
                'vat_amount': invoice_data.get('tax_amount'),
                'total_amount': invoice_data.get('total_amount')
            }
        }

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# Helper functions
def create_tax_compliance_service(region: str = 'SA',
                                  mode: str = 'sandbox') -> TaxComplianceService:
    """
    Create tax compliance service instance

    Args:
        region: Tax region
        mode: 'sandbox' or 'production'

    Returns:
        TaxComplianceService instance
    """
    return TaxComplianceService(region=region, mode=mode)


def get_tax_rate(country_code: str, tax_type: str = 'vat') -> Optional[float]:
    """
    Get tax rate for country

    Args:
        country_code: ISO country code
        tax_type: Tax type

    Returns:
        Tax rate or None
    """
    rates = TaxComplianceService.TAX_RATES.get(country_code.upper())
    if rates:
        return rates.get(tax_type, rates.get('vat'))
    return None
