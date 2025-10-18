import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  AlertTriangle, 
  Calendar, 
  DollarSign,
  FileText,
  ChevronDown,
  RefreshCw,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import type { Invoice } from '../../types/database';
import LoadingSpinner from '../ui/LoadingSpinner';

export default function InvoiceList() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'vendor'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [user]);

  useEffect(() => {
    if (user && invoices.length === 0 && !loading) {
      // If we have a user but no invoices and not loading, we might have missed the initial fetch
      fetchInvoices();
    }
  }, [user, invoices.length, loading]);

  useEffect(() => {
    filterAndSortInvoices();
  }, [invoices, searchTerm, statusFilter, riskFilter, sortBy, sortOrder]);

  const fetchInvoices = async () => {
    if (!user) {
      console.log('No user found, skipping invoice fetch');
      setLoading(false);
      return;
    }

    console.log('Fetching invoices for user:', user.id);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('Invoices fetched successfully:', data?.length || 0);
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      // Set empty array on error to stop loading
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortInvoices = () => {
    let filtered = [...invoices];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(invoice =>
        invoice.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.tax_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === statusFilter);
    }

    // Risk filter
    if (riskFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.fraud_risk === riskFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'date':
          aVal = new Date(a.created_at);
          bVal = new Date(b.created_at);
          break;
        case 'amount':
          aVal = a.amount || 0;
          bVal = b.amount || 0;
          break;
        case 'vendor':
          aVal = a.vendor_name || '';
          bVal = b.vendor_name || '';
          break;
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    setFilteredInvoices(filtered);
  };

  const exportToCSV = () => {
    const headers = ['Vendor', 'Amount', 'Currency', 'Date', 'Status', 'Risk Level', 'Tax ID'];
    const csvContent = [
      headers.join(','),
      ...filteredInvoices.map(invoice => [
        invoice.vendor_name || '',
        invoice.amount || 0,
        invoice.currency || '',
        invoice.invoice_date || '',
        invoice.status,
        invoice.fraud_risk || '',
        invoice.tax_id || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoices.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const viewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const downloadInvoice = async (invoice: Invoice) => {
    try {
      if (!invoice.file_url) {
        showToast('error', 'Download failed', 'File URL not available');
        return;
      }

      // Fetch the file from Supabase storage
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

      showToast('success', 'Download started', `${invoice.file_name} is being downloaded`);
    } catch (error: any) {
      console.error('Download error:', error);
      showToast('error', 'Download failed', error.message || 'Failed to download file');
    }
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            All Invoices ({filteredInvoices.length})
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage and analyze your uploaded invoices
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchInvoices}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            <ChevronDown className={`w-4 h-4 ml-2 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">All Status</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Risk Level</label>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">All Risk Levels</option>
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'vendor')}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="vendor">Vendor</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Order</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
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

      {/* Invoice Table */}
      {filteredInvoices.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Risk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg mr-3">
                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {invoice.vendor_name || 'Unknown Vendor'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {invoice.file_name}
                          </div>
                          {invoice.tax_id && (
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              Tax ID: {invoice.tax_id}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <DollarSign className="w-4 h-4 text-green-500 mr-1" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {invoice.currency} {invoice.amount?.toFixed(2) || 'N/A'}
                        </span>
                      </div>
                      {invoice.vat_amount && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          VAT: {invoice.currency} {invoice.vat_amount.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {invoice.invoice_date 
                          ? new Date(invoice.invoice_date).toLocaleDateString()
                          : new Date(invoice.created_at).toLocaleDateString()
                        }
                      </div>
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
                      <div className="flex items-center">
                        {invoice.fraud_risk === 'high' && (
                          <AlertTriangle className="w-4 h-4 text-red-500 mr-1" />
                        )}
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
                      </div>
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
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No invoices found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {searchTerm || statusFilter !== 'all' || riskFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Upload your first invoice to get started'
            }
          </p>
        </div>
      )}
    </div>
  );
}