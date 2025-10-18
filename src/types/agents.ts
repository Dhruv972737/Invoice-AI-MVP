export interface AgentResult {
  success: boolean;
  data?: any;
  error?: string;
  tokensUsed: number;
}

export interface ProcessingPipeline {
  ingestion?: { completed: boolean; timestamp: string };
  ocr?: { completed: boolean; timestamp: string };
  classification?: { completed: boolean; timestamp: string };
  fraud_detection?: { completed: boolean; timestamp: string };
  tax_compliance?: { completed: boolean; timestamp: string };
  reporting?: { completed: boolean; timestamp: string };
}

export interface InvoiceProcessingResult {
  invoiceId: string;
  status: 'completed' | 'failed';
  results: {
    ingestion: any;
    ocr: any;
    classification: any;
    fraud: any;
    tax: any;
    report: any;
  };
}

export interface AgentExecutionLog {
  id: string;
  user_id: string;
  invoice_id: string | null;
  agent_name: 'ingestion' | 'ocr' | 'classification' | 'fraud_detection' | 'tax_compliance' | 'reporting' | 'chatbot';
  status: 'started' | 'completed' | 'failed';
  execution_time_ms: number;
  input_data: any;
  output_data: any;
  error_message: string | null;
  created_at: string;
}