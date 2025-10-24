import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, MessageSquare, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { GeminiService, type InvoiceContext } from '../../lib/ai/geminiService';
import { getAIRouter } from '../../lib/ai/multiProviderRouter';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export default function ChatBot() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const quickQueries = [
    { text: t('chat.quickQueries.highRisk.text'), query: t('chat.quickQueries.highRisk.query') },
    { text: t('chat.quickQueries.totalSpent.text'), query: t('chat.quickQueries.totalSpent.query') },
    { text: t('chat.quickQueries.vatSummary.text'), query: t('chat.quickQueries.vatSummary.query') },
    { text: t('chat.quickQueries.topVendors.text'), query: t('chat.quickQueries.topVendors.query') },
    { text: t('chat.quickQueries.pending.text'), query: t('chat.quickQueries.pending.query') },
    { text: t('chat.quickQueries.trends.text'), query: t('chat.quickQueries.trends.query') }
  ];

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: "Hi! I'm your AI invoice assistant. I can help you analyze invoices, find spending patterns, and answer questions about your data. What would you like to know?",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const geminiService = null; // Disabled - using free libraries only

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const generateResponse = async (query: string): Promise<string> => {
    try {
      // Fetch user's invoices for context
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user!.id);

      if (error) throw error;

      if (!geminiService) {
        showToast('warning', 'AI Not Available', 'Gemini API key not configured. Using fallback responses.');
        return generateFallbackResponse(query, invoices);
      }

      // Prepare context for Gemini
      const context: InvoiceContext = {
        totalInvoices: invoices.length,
        totalAmount: invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
        vendors: [...new Set(invoices.map(inv => inv.vendor_name).filter(Boolean))],
        highRiskCount: invoices.filter(inv => inv.fraud_risk === 'high').length,
        monthlyData: calculateMonthlyData(invoices),
        recentInvoices: invoices.slice(0, 10).map(inv => ({
          vendor: inv.vendor_name || 'Unknown',
          amount: inv.amount || 0,
          date: inv.invoice_date || inv.created_at.split('T')[0],
          risk: inv.fraud_risk || 'unknown'
        }))
      };

      // Use Gemini AI for response
      try {
        const response = await geminiService.generateResponse(query, context, chatHistory);
        return response;
      } catch (geminiError: any) {
        console.error('Gemini API error:', geminiError);
        
        // Check if it's a quota/rate limit error
        if (geminiError.message?.includes('quota') || 
            geminiError.message?.includes('429') ||
            geminiError.message?.includes('rate limit') ||
            geminiError.message?.includes('exceeded your current quota') ||
            geminiError.message === 'QUOTA_EXCEEDED') {
          showToast('warning', 'AI Quota Exceeded', 'Gemini API quota exceeded. Using fallback responses. Please check your API key billing.');
        } else {
          showToast('warning', 'AI Temporarily Unavailable', 'Gemini API error. Using fallback responses.');
        }
        
        // Fall back to pattern-based responses
        return generateFallbackResponse(query, invoices);
      }

    } catch (error: any) {
      console.error('Error generating response:', error);
      
      // Fallback to pattern-based responses
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user!.id);
      
      return generateFallbackResponse(query, invoices || []);
    }
  };

  const calculateMonthlyData = (invoices: any[]) => {
    const monthlyData: { [key: string]: { amount: number; count: number } } = {};
    
    invoices.forEach(inv => {
      const month = new Date(inv.created_at).toISOString().slice(0, 7);
      if (!monthlyData[month]) monthlyData[month] = { amount: 0, count: 0 };
      monthlyData[month].amount += inv.amount || 0;
      monthlyData[month].count++;
    });
    
    return Object.entries(monthlyData)
      .sort()
      .slice(-6)
      .map(([month, data]) => ({ month, ...data }));
  };

  const generateFallbackResponse = (query: string, invoices: any[]): string => {
      const lowerQuery = query.toLowerCase();

      if (lowerQuery.includes('high risk') || lowerQuery.includes('risky')) {
        const highRiskInvoices = invoices.filter(inv => inv.fraud_risk === 'high');
        if (highRiskInvoices.length === 0) {
          return "Great news! You don't have any high-risk invoices currently.";
        }
        return `I found ${highRiskInvoices.length} high-risk invoices:\n\n${highRiskInvoices.map(inv => 
          `• ${inv.vendor_name || 'Unknown Vendor'}: $${inv.amount?.toFixed(2) || 'N/A'} (${inv.file_name})`
        ).join('\n')}\n\nI recommend reviewing these invoices for potential fraud indicators.`;
      }

      if (lowerQuery.includes('total') && (lowerQuery.includes('month') || lowerQuery.includes('spent'))) {
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        const monthlyInvoices = invoices.filter(inv => {
          const invDate = new Date(inv.created_at);
          return invDate.getMonth() === thisMonth && invDate.getFullYear() === thisYear;
        });
        const total = monthlyInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
        return `This month, you've spent a total of $${total.toFixed(2)} across ${monthlyInvoices.length} invoices.`;
      }

      if (lowerQuery.includes('vat') || lowerQuery.includes('tax')) {
        const vatSummary = invoices.reduce((acc: any, inv) => {
          const region = inv.tax_region || 'Unknown';
          if (!acc[region]) acc[region] = { count: 0, total: 0 };
          acc[region].count++;
          acc[region].total += inv.vat_amount || 0;
          return acc;
        }, {});

        const summary = Object.entries(vatSummary)
          .map(([region, data]: [string, any]) => 
            `• ${region}: $${data.total.toFixed(2)} (${data.count} invoices)`
          ).join('\n');

        return `Here's your VAT summary by region:\n\n${summary}`;
      }

      if (lowerQuery.includes('vendor') || lowerQuery.includes('supplier')) {
        const vendorCounts = invoices.reduce((acc: any, inv) => {
          const vendor = inv.vendor_name || 'Unknown';
          acc[vendor] = (acc[vendor] || 0) + 1;
          return acc;
        }, {});

        const topVendors = Object.entries(vendorCounts)
          .sort(([,a], [,b]) => (b as number) - (a as number))
          .slice(0, 5)
          .map(([vendor, count]) => `• ${vendor}: ${count} invoices`)
          .join('\n');

        return `Your top vendors by invoice count:\n\n${topVendors}`;
      }

      if (lowerQuery.includes('processing') || lowerQuery.includes('pending')) {
        const processingInvoices = invoices.filter(inv => inv.status === 'processing');
        if (processingInvoices.length === 0) {
          return "All your invoices have been processed successfully!";
        }
        return `You have ${processingInvoices.length} invoices still processing:\n\n${processingInvoices.map(inv => 
          `• ${inv.file_name} (uploaded ${new Date(inv.created_at).toLocaleDateString()})`
        ).join('\n')}`;
      }

      if (lowerQuery.includes('trend') || lowerQuery.includes('monthly')) {
        const monthlyData = invoices.reduce((acc: any, inv) => {
          const month = new Date(inv.created_at).toISOString().slice(0, 7);
          if (!acc[month]) acc[month] = { count: 0, amount: 0 };
          acc[month].count++;
          acc[month].amount += inv.amount || 0;
          return acc;
        }, {});

        const trends = Object.entries(monthlyData)
          .sort()
          .slice(-6)
          .map(([month, data]: [string, any]) => 
            `• ${month}: $${data.amount.toFixed(2)} (${data.count} invoices)`
          ).join('\n');

        return `Your spending trends over the last 6 months:\n\n${trends}`;
      }

      // Default response
      const totalInvoices = invoices.length;
      const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const avgAmount = totalInvoices > 0 ? totalAmount / totalInvoices : 0;

      return `Here's a quick overview of your invoices:\n\n• Total invoices: ${totalInvoices}\n• Total amount: $${totalAmount.toFixed(2)}\n• Average amount: $${avgAmount.toFixed(2)}\n\nIs there something specific you'd like to know about your invoices?`;

  };

  const handleSend = async (text: string = inputText) => {
    if (!text.trim() || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',  // Note: 'type' not 'role'
      content: text.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);  // Note: 'loading' not 'isTyping'

    try {
      // Get invoices for context
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id);

      // Use multi-provider AI router
      const aiRouter = getAIRouter(user.id);
      
      const context = {
        totalInvoices: invoices?.length || 0,
        totalAmount: invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0,
        recentInvoices: invoices?.slice(0, 10).map(inv => ({
          vendor: inv.vendor_name || 'Unknown',
          amount: inv.amount || 0,
          date: inv.invoice_date || inv.created_at.split('T')[0],
          risk: inv.fraud_risk || 'unknown'
        })) || []
      };

      const response = await aiRouter.chatResponse(text.trim(), context);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',  // Note: 'type' not 'role'
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      
      // Update chat history for context
      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: text.trim() },
        { role: 'assistant', content: response }
      ].slice(-10));
      
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-t-xl shadow-sm border border-gray-200 dark:border-gray-700 border-b-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('chat.title')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('chat.subtitle')}
            </p>
          </div>
          <div className="flex-1" />
        </div>
      </div>

      {/* Quick Queries */}
      <div className="bg-white dark:bg-gray-800 px-4 py-3 border-x border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-2">
          <Zap className="w-4 h-4 text-yellow-500 mr-2" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('chat.quickQueriesLabel')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickQueries.map((query, index) => (
            <button
              key={index}
              onClick={() => handleSend(query.query)}
              className="px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              {query.text}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 bg-white dark:bg-gray-800 overflow-y-auto p-4 space-y-4 border-x border-gray-200 dark:border-gray-700">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-3 ${
              message.type === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.type === 'bot' && (
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            )}
            
            <div
              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-sm'
              }`}
            >
              <p className="text-sm whitespace-pre-line">{message.content}</p>
              <p className={`text-xs mt-2 ${
                message.type === 'user' 
                  ? 'text-blue-200' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>

            {message.type === 'user' && (
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full">
              <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-600 dark:text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('chat.thinking')}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-b-xl shadow-sm border border-gray-200 dark:border-gray-700 border-t-0">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('chat.inputPlaceholder')}
              rows={1}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
              disabled={loading}
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={loading || !inputText.trim()}
            className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          {geminiService
            ? t('chat.disclaimer.gemini')
            : t('chat.disclaimer.fallback')
          }
        </p>
      </div>
    </div>
  );
}