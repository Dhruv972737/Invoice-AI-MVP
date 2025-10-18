# 📄 Sample Invoice Files for Testing

This directory contains sample invoice files for testing the Invoice AI Platform. These files demonstrate various invoice formats, languages, and complexity levels that the AI processing pipeline can handle.

## 📋 **Test Files Overview**

### **PDF Invoices**
- `sample-invoice-1.pdf` - Standard business invoice (English)
- `sample-invoice-2.pdf` - Service invoice with tax details
- `sample-invoice-3.pdf` - Product invoice with multiple line items
- `sample-invoice-recurring.pdf` - Recurring subscription invoice

### **Image Invoices**
- `sample-invoice-scan.jpg` - Scanned paper invoice
- `sample-invoice-photo.png` - Mobile phone photo of invoice
- `sample-receipt.jpeg` - Simple receipt format

### **Multi-Language Invoices**
- `invoice-spanish.pdf` - Spanish language invoice
- `invoice-french.pdf` - French language invoice
- `invoice-german.pdf` - German language invoice

### **Complex Scenarios**
- `invoice-handwritten.jpg` - Partially handwritten invoice
- `invoice-low-quality.png` - Low resolution/quality scan
- `invoice-rotated.jpg` - Rotated image requiring correction

## 🧪 **Testing Scenarios**

### **Basic Functionality**
1. Upload each file type (PDF, JPEG, PNG)
2. Verify OCR text extraction
3. Check AI field extraction accuracy
4. Validate fraud risk assessment

### **AI Processing Tests**
- **Vendor Name Extraction**: Test various company name formats
- **Amount Detection**: Different currency formats and decimal separators
- **Date Recognition**: Various date formats (DD/MM/YYYY, MM-DD-YYYY, etc.)
- **Tax ID Validation**: Different tax ID formats by region

### **Edge Cases**
- **Poor Image Quality**: Test OCR robustness
- **Multiple Languages**: Verify language detection
- **Unusual Formats**: Non-standard invoice layouts
- **Fraud Indicators**: Invoices with suspicious patterns

## 📊 **Expected Results**

### **High Accuracy Files** (>90% confidence)
- `sample-invoice-1.pdf`
- `sample-invoice-2.pdf`
- `sample-invoice-3.pdf`

### **Medium Accuracy Files** (70-90% confidence)
- `sample-invoice-scan.jpg`
- `invoice-spanish.pdf`
- `invoice-french.pdf`

### **Challenging Files** (50-70% confidence)
- `invoice-handwritten.jpg`
- `invoice-low-quality.png`
- `invoice-rotated.jpg`

## 🔍 **What to Test**

### **OCR Accuracy**
- Text extraction completeness
- Character recognition accuracy
- Layout preservation

### **AI Field Extraction**
- Vendor name identification
- Invoice amount detection
- Date parsing accuracy
- Tax ID extraction
- Currency recognition

### **Fraud Detection**
- Risk level assessment
- Anomaly detection
- Pattern recognition

### **Language Processing**
- Language identification
- Multi-language support
- Character encoding handling

## 📝 **Test Credentials**

Use these test accounts to upload and process sample invoices:

```
Primary Test Account:
Email: demo@invoiceai.com
Password: Demo123456!

Secondary Test Account:
Email: test@example.com
Password: TestUser123!
```

## 🚀 **Testing Workflow**

1. **Login** with test credentials
2. **Navigate** to Upload Invoice page
3. **Select** sample file from this directory
4. **Upload** and wait for processing
5. **Review** extracted data accuracy
6. **Check** fraud risk assessment
7. **Test** chatbot queries about the invoice
8. **Export** data to verify completeness

## 📈 **Performance Benchmarks**

### **Processing Time Targets**
- PDF files: < 10 seconds
- Image files: < 15 seconds
- Large files (>5MB): < 30 seconds

### **Accuracy Targets**
- Vendor name: >85% accuracy
- Invoice amount: >95% accuracy
- Invoice date: >90% accuracy
- Tax information: >80% accuracy

## 🔧 **Troubleshooting**

### **Common Issues**
- **File too large**: Compress images before upload
- **Unsupported format**: Use PDF, JPEG, or PNG only
- **Poor OCR results**: Try higher resolution images
- **Missing fields**: Check if information is clearly visible

### **Best Practices**
- Use high-resolution scans (300+ DPI)
- Ensure good lighting for photos
- Avoid skewed or rotated images
- Keep file sizes under 10MB

## 📞 **Support**

If you encounter issues with any sample files:
1. Check browser console for errors
2. Verify file format and size
3. Try different sample files
4. Report issues via GitHub Issues

---

**Note**: These sample files are for testing purposes only and contain fictional business information.