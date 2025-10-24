import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  PieChart,
  BarChart3,
  Calendar,
  DollarSign,
  AlertTriangle,
  Download,
  Filter
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import type { Invoice } from '../../types/database';
import LoadingSpinner from '../ui/LoadingSpinner';

interface AnalyticsData {
  monthlyTrends: { month: string; amount: number; count: number }[];
  vendorBreakdown: { vendor: string; amount: number; count: number }[];
  riskDistribution: { risk: string; count: number; percentage: number }[];
  taxSummary: { region: string; vat: number; invoices: number }[];
  statusBreakdown: { status: string; count: number; percentage: number }[];
}

export default function Analytics() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('6months');

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user, dateRange]);

  const fetchAnalytics = async () => {
    try {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user!.id);

      if (error) throw error;

      // Filter by date range
      const cutoffDate = new Date();
      switch (dateRange) {
        case '1month':
          cutoffDate.setMonth(cutoffDate.getMonth() - 1);
          break;
        case '3months':
          cutoffDate.setMonth(cutoffDate.getMonth() - 3);
          break;
        case '6months':
          cutoffDate.setMonth(cutoffDate.getMonth() - 6);
          break;
        case '1year':
          cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
          break;
        default:
          cutoffDate.setFullYear(2000); // All time
      }

      const filteredInvoices = invoices.filter(inv => 
        new Date(inv.created_at) >= cutoffDate
      );

      // Calculate analytics
      const analytics = calculateAnalytics(filteredInvoices);
      setData(analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (invoices: Invoice[]): AnalyticsData => {
    // Monthly trends
    const monthlyData: { [key: string]: { amount: number; count: number } } = {};
    invoices.forEach(inv => {
      const month = new Date(inv.created_at).toISOString().slice(0, 7);
      if (!monthlyData[month]) monthlyData[month] = { amount: 0, count: 0 };
      monthlyData[month].amount += inv.total_amount || inv.amount || 0;
      monthlyData[month].count++;
    });
    
    const monthlyTrends = Object.entries(monthlyData)
      .sort()
      .map(([month, data]) => ({ month, ...data }));

    // Vendor breakdown
    const vendorData: { [key: string]: { amount: number; count: number } } = {};
    invoices.forEach(inv => {
      const vendor = inv.vendor_name || 'Unknown';
      if (!vendorData[vendor]) vendorData[vendor] = { amount: 0, count: 0 };
      vendorData[vendor].amount += inv.total_amount || inv.amount || 0;
      vendorData[vendor].count++;
    });
    
    const vendorBreakdown = Object.entries(vendorData)
      .map(([vendor, data]) => ({ vendor, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Risk distribution
    const riskCounts: { [key: string]: number } = { low: 0, medium: 0, high: 0, unknown: 0 };
    invoices.forEach(inv => {
      const risk = inv.fraud_risk || 'unknown';
      riskCounts[risk]++;
    });
    
    const totalInvoices = invoices.length;
    const riskDistribution = Object.entries(riskCounts)
      .map(([risk, count]) => ({
        risk,
        count,
        percentage: totalInvoices > 0 ? (count / totalInvoices) * 100 : 0
      }))
      .filter(item => item.count > 0);

    // Tax summary
    const taxData: { [key: string]: { vat: number; invoices: number } } = {};
    invoices.forEach(inv => {
      const region = inv.tax_region || 'Unknown';
      if (!taxData[region]) taxData[region] = { vat: 0, invoices: 0 };
      taxData[region].vat += inv.vat_amount || 0;
      taxData[region].invoices++;
    });
    
    const taxSummary = Object.entries(taxData)
      .map(([region, data]) => ({ region, ...data }));

    // Status breakdown
    const statusCounts: { [key: string]: number } = { processing: 0, completed: 0, failed: 0 };
    invoices.forEach(inv => {
      statusCounts[inv.status]++;
    });
    
    const statusBreakdown = Object.entries(statusCounts)
      .map(([status, count]) => ({
        status,
        count,
        percentage: totalInvoices > 0 ? (count / totalInvoices) * 100 : 0
      }))
      .filter(item => item.count > 0);

    return {
      monthlyTrends,
      vendorBreakdown,
      riskDistribution,
      taxSummary,
      statusBreakdown
    };
  };

  const exportAnalytics = () => {
    if (!data) return;
    
    const report = {
      generatedAt: new Date().toISOString(),
      dateRange,
      summary: {
        totalVendors: data.vendorBreakdown.length,
        totalAmount: data.vendorBreakdown.reduce((sum, v) => sum + v.amount, 0),
        totalInvoices: data.vendorBreakdown.reduce((sum, v) => sum + v.count, 0)
      },
      monthlyTrends: data.monthlyTrends,
      vendorBreakdown: data.vendorBreakdown,
      riskDistribution: data.riskDistribution,
      taxSummary: data.taxSummary
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('analytics.title')}</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {t('analytics.subtitle')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-white"
            >
              <option value="1month">{t('analytics.filters.lastMonth')}</option>
              <option value="3months">{t('analytics.filters.last3Months')}</option>
              <option value="6months">{t('analytics.filters.last6Months')}</option>
              <option value="1year">{t('analytics.filters.lastYear')}</option>
              <option value="all">{t('analytics.filters.allTime')}</option>
            </select>
          </div>
          <button
            onClick={exportAnalytics}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
          >
            <Download className="w-4 h-4 mr-2" />
            {t('common.export')}
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('analytics.cards.totalValue')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${data?.vendorBreakdown.reduce((sum, v) => sum + v.amount, 0).toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('analytics.cards.totalInvoices')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.vendorBreakdown.reduce((sum, v) => sum + v.count, 0) || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <PieChart className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('analytics.cards.uniqueVendors')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.vendorBreakdown.length || 0}
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
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('analytics.cards.highRisk')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.riskDistribution.find(r => r.risk === 'high')?.count || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trends */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('analytics.sections.monthlyTrends')}</h3>
          </div>
          <div className="space-y-3">
            {data?.monthlyTrends.slice(-6).map((item, index) => (
              <div key={item.month} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {new Date(item.month + '-01').toLocaleDateString([], { month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    ${item.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.count} {t('common.invoices')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <PieChart className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('analytics.sections.riskDistribution')}</h3>
          </div>
          <div className="space-y-3">
            {data?.riskDistribution.map((item) => (
              <div key={item.risk} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    item.risk === 'high' ? 'bg-red-500' :
                    item.risk === 'medium' ? 'bg-yellow-500' :
                    item.risk === 'low' ? 'bg-green-500' : 'bg-gray-500'
                  }`}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                    {item.risk} {t('common.risk')}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.count} ({item.percentage.toFixed(1)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Vendors */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('analytics.sections.topVendors')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('common.vendor')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('invoices.totalAmount')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('analytics.invoiceCount')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('analytics.average')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data?.vendorBreakdown.slice(0, 10).map((vendor, index) => (
                <tr key={vendor.vendor} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {vendor.vendor}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    ${vendor.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {vendor.count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    ${(vendor.amount / vendor.count).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('analytics.sections.taxSummary')}</h3>
          </div>
          <div className="p-6 space-y-4">
            {data?.taxSummary.map((item) => (
              <div key={item.region} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.region}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.invoices} {t('common.invoices')}
                  </p>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  ${item.vat.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('analytics.sections.processingStatus')}</h3>
          </div>
          <div className="p-6 space-y-4">
            {data?.statusBreakdown.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    item.status === 'completed' ? 'bg-green-500' :
                    item.status === 'processing' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                    {item.status}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.count} ({item.percentage.toFixed(1)}%)
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}