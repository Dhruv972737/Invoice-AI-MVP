import React, { useEffect, useState } from 'react';
import {
  FileText,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Calendar,
  Eye,
  Download,
  X,
  Bot
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import type { Invoice } from '../../types/database';
import LoadingSpinner from '../ui/LoadingSpinner';

interface DashboardStats {
  totalInvoices: number;
  totalAmount: number;
  flaggedInvoices: number;
  thisMonthInvoices: number;
  averageAmount: number;
  topVendor: string;
}

interface DashboardHomeProps {
  setActiveView: (view: 'dashboard' | 'upload' | 'invoices' | 'chat' | 'analytics' | 'settings') => void;
}

export default function DashboardHome({ setActiveView }: DashboardHomeProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate stats
      const totalInvoices = invoices.length;
      const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const flaggedInvoices = invoices.filter(inv => inv.fraud_risk === 'high' || inv.fraud_risk === 'medium').length;
      
      const thisMonth = new Date().getMonth();
      const thisYear = new Date().getFullYear();
      const thisMonthInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.created_at);
        return invDate.getMonth() === thisMonth && invDate.getFullYear() === thisYear;
      }).length;

      const averageAmount = totalInvoices > 0 ? totalAmount / totalInvoices : 0;
      
      const vendorCounts: { [key: string]: number } = {};
      invoices.forEach(inv => {
        if (inv.vendor_name) {
          vendorCounts[inv.vendor_name] = (vendorCounts[inv.vendor_name] || 0) + 1;
        }
      });
      
      const topVendor = Object.keys(vendorCounts).reduce((a, b) => 
        vendorCounts[a] > vendorCounts[b] ? a : b, Object.keys(vendorCounts)[0] || 'N/A'
      );

      setStats({
        totalInvoices,
        totalAmount,
        flaggedInvoices,
        thisMonthInvoices,
        averageAmount,
        topVendor
      });

      setRecentInvoices(invoices.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async (invoice: Invoice) => {
    try {
      if (!invoice.file_url) {
        showToast('error', t('toast.uploadError'), t('invoices.details.fileName'));
        return;
      }

      const response = await fetch(invoice.file_url);
      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = invoice.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('success', t('common.download'), `${invoice.file_name}`);
    } catch (error: any) {
      console.error('Download error:', error);
      showToast('error', t('toast.uploadError'), error.message);
    }
  };

  const viewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const closeModal = () => {
    setShowInvoiceModal(false);
    setSelectedInvoice(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboard.cards.totalInvoices')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalInvoices || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboard.cards.totalValue')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${stats?.totalAmount.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboard.cards.flagged')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.flaggedInvoices || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboard.cards.thisMonth')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.thisMonthInvoices || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.sections.recentInvoices')}</h3>
            <button className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
              {t('common.viewAll')}
            </button>
          </div>
        </div>

        {recentInvoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('dashboard.tableHeaders.vendor')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('dashboard.tableHeaders.amount')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('dashboard.tableHeaders.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('dashboard.tableHeaders.riskLevel')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('dashboard.tableHeaders.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {invoice.vendor_name || 'Unknown Vendor'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {invoice.file_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {invoice.currency} {invoice.amount?.toFixed(2) || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        invoice.status === 'completed' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                          : invoice.status === 'processing'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        invoice.fraud_risk === 'low' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                          : invoice.fraud_risk === 'medium'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                          : invoice.fraud_risk === 'high'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300'
                      }`}>
                        {invoice.fraud_risk || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => viewInvoice(invoice)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => downloadInvoice(invoice)}
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 p-1"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{t('dashboard.empty.title')}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('dashboard.empty.message')}
            </p>
            <div className="mt-6">
              <button
                onClick={() => setActiveView('upload')}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <TrendingUp className="-ml-1 mr-2 h-5 w-5" />
                {t('dashboard.empty.uploadButton')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invoice Details Modal */}
      {showInvoiceModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={closeModal}></div>
            
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                    Invoice Details
                  </h3>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Vendor Name
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {selectedInvoice.vendor_name || 'Unknown'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Amount
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {selectedInvoice.currency} {selectedInvoice.amount?.toFixed(2) || 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Invoice Date
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {selectedInvoice.invoice_date 
                          ? new Date(selectedInvoice.invoice_date).toLocaleDateString()
                          : 'N/A'
                        }
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Status
                      </label>
                      <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedInvoice.status === 'completed' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                          : selectedInvoice.status === 'processing'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                      }`}>
                        {selectedInvoice.status}
                      </span>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Risk Level
                      </label>
                      <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedInvoice.fraud_risk === 'low' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                          : selectedInvoice.fraud_risk === 'medium'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                          : selectedInvoice.fraud_risk === 'high'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300'
                      }`}>
                        {selectedInvoice.fraud_risk || 'Unknown'}
                      </span>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Tax ID
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {selectedInvoice.tax_id || 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Language
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {selectedInvoice.language || 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Classification
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">
                        {selectedInvoice.classification || 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        VAT Amount
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {selectedInvoice.vat_amount 
                          ? `${selectedInvoice.currency} ${selectedInvoice.vat_amount.toFixed(2)}`
                          : 'N/A'
                        }
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Tax Region
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {selectedInvoice.tax_region || 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        File Name
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {selectedInvoice.file_name}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Upload Date
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {new Date(selectedInvoice.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Processing Data */}
                  {selectedInvoice.processed_data && (
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Processing Information
                      </label>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                        {selectedInvoice.processed_data.ocr_confidence && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">OCR Confidence:</span>
                            <span className="text-sm text-gray-900 dark:text-white">
                              {Math.round(selectedInvoice.processed_data.ocr_confidence * 100)}%
                            </span>
                          </div>
                        )}
                        {selectedInvoice.processed_data.ai_confidence && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">AI Confidence:</span>
                            <span className="text-sm text-gray-900 dark:text-white">
                              {Math.round(selectedInvoice.processed_data.ai_confidence * 100)}%
                            </span>
                          </div>
                        )}
                        {selectedInvoice.processed_data.fraud_score && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Fraud Score:</span>
                            <span className="text-sm text-gray-900 dark:text-white">
                              {Math.round(selectedInvoice.processed_data.fraud_score * 100)}%
                            </span>
                          </div>
                        )}
                        {selectedInvoice.processed_data.extraction_method && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Extraction Method:</span>
                            <span className="text-sm text-gray-900 dark:text-white capitalize">
                              {selectedInvoice.processed_data.extraction_method.replace('_', ' ')}
                            </span>
                          </div>
                        )}
                        {selectedInvoice.processed_data.fraud_reasons && selectedInvoice.processed_data.fraud_reasons.length > 0 && (
                          <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Fraud Indicators:</span>
                            <ul className="mt-1 text-sm text-gray-900 dark:text-white list-disc list-inside">
                              {selectedInvoice.processed_data.fraud_reasons.map((reason: string, index: number) => (
                                <li key={index}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={() => downloadInvoice(selectedInvoice)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </button>
                <button
                  onClick={closeModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('dashboard.sections.quickStats')}</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.stats.averageValue')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                ${stats?.averageAmount.toFixed(2) || '0.00'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.stats.topVendor')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {stats?.topVendor || t('common.notAvailable')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Chatbot Button */}
      <button
        onClick={() => setActiveView('chat')}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
        title={t('dashboard.aiAssistant.tooltip')}
      >
        <Bot className="w-6 h-6" />
        <div className="absolute -top-2 -left-2 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
        <div className="absolute right-full mr-3 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          {t('dashboard.aiAssistant.tooltip')}
          <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
        </div>
      </button>
    </div>
  );
}