# 🔌 Invoice AI Platform API Documentation

## 📋 **Overview**

The Invoice AI Platform provides a RESTful API for health monitoring and system information. The main application functionality (invoice processing, authentication, etc.) is handled through the Supabase integration on the frontend.

### **Base URLs**
- **Production**: `https://invoice-ai-backend.onrender.com`
- **Development**: `http://localhost:10000`

### **Interactive Documentation**
- **Swagger UI**: [https://invoice-ai-backend.onrender.com/api-docs](https://invoice-ai-backend.onrender.com/api-docs)

## 🔐 **Authentication**

The API currently provides system endpoints that don't require authentication. User authentication and invoice processing are handled through Supabase on the frontend.

## 📡 **Endpoints**

### **System Endpoints**

#### **GET /** - Root Information
Returns basic information about the API server.

**Response:**
```json
{
  "message": "Invoice AI Backend is running on Render! 🚀",
  "status": "healthy",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "platform": "Render",
  "port": 10000,
  "environment": "production",
  "node_version": "v20.17.0",
  "host": "0.0.0.0",
  "supabase_configured": true,
  "service_key_configured": true,
  "frontend_url": "https://invoice-ai-mvp.netlify.app",
  "endpoints": {
    "health": "/api/health",
    "test": "/api/test",
    "root": "/",
    "docs": "/api-docs"
  }
}
```

#### **GET /api/health** - Health Check
Provides detailed health information for monitoring services.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "version": "1.0.0",
  "platform": "Render",
  "environment": "production",
  "port": 10000,
  "uptime": 3600,
  "memory": {
    "used": 45,
    "total": 512
  },
  "render_service": "invoice-ai-backend",
  "supabase_status": "configured",
  "service_key_status": "configured"
}
```

#### **GET /api/test** - API Test
Tests API functionality and returns system information.

**Response:**
```json
{
  "message": "Render API is working perfectly! ✅",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "method": "GET",
  "platform": "Render",
  "headers": {
    "user-agent": "Mozilla/5.0...",
    "host": "invoice-ai-backend.onrender.com",
    "x-forwarded-for": "192.168.1.1",
    "x-render-origin-name": "invoice-ai-backend"
  },
  "query": {},
  "render_info": {
    "port": "10000",
    "environment": "production",
    "service": "invoice-ai-backend",
    "region": "oregon"
  }
}
```

#### **GET /api** - API Information
Returns general information about the API.

**Response:**
```json
{
  "name": "Invoice AI API",
  "version": "1.0.0",
  "platform": "Render",
  "endpoints": {
    "health": "/api/health",
    "test": "/api/test",
    "root": "/",
    "docs": "/api-docs"
  },
  "status": "operational",
  "render_configured": true,
  "documentation": "https://github.com/Dhruv972737/Invoice-AI-MVP"
}
```

## 🚨 **Error Responses**

### **404 Not Found**
```json
{
  "error": "API route not found",
  "path": "/api/nonexistent",
  "method": "GET",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "available_endpoints": [
    "/",
    "/api/health",
    "/api/test",
    "/api",
    "/api-docs"
  ],
  "platform": "Render"
}
```

### **500 Internal Server Error**
```json
{
  "error": "Internal server error",
  "message": "Something went wrong",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "platform": "Render"
}
```

## 📊 **Response Codes**

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful |
| 404 | Not Found | Endpoint not found |
| 500 | Internal Server Error | Server error occurred |

## 🔧 **CORS Configuration**

The API supports CORS for the following origins:
- `http://localhost:5173` (Development)
- `http://localhost:3000` (Development)
- `https://invoice-ai-mvp.netlify.app` (Production)

**Allowed Methods:** GET, POST, PUT, DELETE, OPTIONS
**Allowed Headers:** Content-Type, Authorization

## 📈 **Rate Limiting**

Currently, no rate limiting is implemented. The API is designed for health monitoring and system information only.

## 🧪 **Testing the API**

### **Using cURL**

```bash
# Health check
curl https://invoice-ai-backend.onrender.com/api/health

# Test endpoint
curl https://invoice-ai-backend.onrender.com/api/test

# Root information
curl https://invoice-ai-backend.onrender.com/
```

### **Using Postman**

Import the Postman collection from `/docs/postman-collection.json` for easy testing.

### **Using Browser**

Visit any endpoint directly in your browser:
- [https://invoice-ai-backend.onrender.com/api/health](https://invoice-ai-backend.onrender.com/api/health)
- [https://invoice-ai-backend.onrender.com/api/test](https://invoice-ai-backend.onrender.com/api/test)

## 🔍 **Monitoring**

### **Health Check Monitoring**

The `/api/health` endpoint is designed for monitoring services and provides:
- Server status
- Uptime information
- Memory usage
- Environment configuration
- Supabase connection status

### **Logging**

All requests are logged with:
- Timestamp
- HTTP method and path
- Client IP address
- User agent (truncated)

## 🚀 **Future API Endpoints**

The following endpoints are planned for future releases:

### **Invoice Processing** (Planned)
- `POST /api/invoices` - Upload and process invoice
- `GET /api/invoices` - List user invoices
- `GET /api/invoices/:id` - Get specific invoice
- `DELETE /api/invoices/:id` - Delete invoice

### **Analytics** (Planned)
- `GET /api/analytics/summary` - Get analytics summary
- `GET /api/analytics/trends` - Get spending trends
- `GET /api/analytics/vendors` - Get vendor analysis

### **AI Processing** (Planned)
- `POST /api/ai/ocr` - OCR text extraction
- `POST /api/ai/extract` - Field extraction
- `POST /api/ai/analyze` - Fraud analysis

## 📞 **Support**

### **Issues**
Report API issues on [GitHub Issues](https://github.com/Dhruv972737/Invoice-AI-MVP/issues)

### **Documentation**
- **Swagger UI**: [https://invoice-ai-backend.onrender.com/api-docs](https://invoice-ai-backend.onrender.com/api-docs)
- **GitHub Repository**: [https://github.com/Dhruv972737/Invoice-AI-MVP](https://github.com/Dhruv972737/Invoice-AI-MVP)

### **Status Page**
Monitor API status at: [https://invoice-ai-backend.onrender.com/api/health](https://invoice-ai-backend.onrender.com/api/health)

---

**Last Updated**: January 27, 2025
**API Version**: 1.0.0