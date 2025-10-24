// ============================================
// ADMIN DASHBOARD COMPONENT
// System monitoring and user management
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Zap,
  DollarSign,
  TrendingUp,
  Activity,
  Database,
  Server,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalInvoices: number;
  totalTokensUsed: number;
  totalRevenue: number;
  avgProcessingTime: number;
}

interface UserStat {
  userId: string;
  email: string;
  fullName: string;
  totalInvoices: number;
  tokensUsed: number;
  subscriptionPlan: string;
  createdAt: string;
}

interface AIProviderStat {
  provider: string;
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  totalCost: number;
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [topUsers, setTopUsers] = useState<UserStat[]>([]);
  const [aiProviderStats, setAIProviderStats] = useState<AIProviderStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemStats();
    fetchTopUsers();
    fetchAIProviderStats();
  }, []);

  const fetchSystemStats = async () => {
    try {
      // Get total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get active users (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { count: activeUsers } = await supabase
        .from('login_history')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      // Get total invoices
      const { count: totalInvoices } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });

      // Get total tokens used
      const { data: tokenData } = await supabase
        .from('token_usage_logs')
        .select('tokens_used');
      
      const totalTokensUsed = tokenData?.reduce((sum, log) => sum + log.tokens_used, 0) || 0;

      // Get total revenue
      const { data: revenueData } = await supabase
        .from('payment_transactions')
        .select('amount')
        .eq('status', 'completed');
      
      const totalRevenue = revenueData?.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0;

      // Get average processing time
      const { data: agentLogs } = await supabase
        .from('agent_execution_logs')
        .select('execution_time_ms')
        .eq('status', 'completed')
        .limit(100);
      
      const avgProcessingTime = agentLogs?.length 
        ? agentLogs.reduce((sum, log) => sum + log.execution_time_ms, 0) / agentLogs.length 
        : 0;

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalInvoices: totalInvoices || 0,
        totalTokensUsed,
        totalRevenue,
        avgProcessingTime
      });

    } catch (error) {
      console.error('Error fetching system stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopUsers = async () => {
    try {
      const { data: users } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          subscription_plan,
          created_at
        `)
        .limit(10);

      if (!users) return;

      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          // Get invoice count
          const { count: invoiceCount } = await supabase
            .from('invoices')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

          // Get token usage
          const { data: tokenData } = await supabase
            .from('token_usage_logs')
            .select('tokens_used')
            .eq('user_id', user.id);

          const tokensUsed = tokenData?.reduce((sum, log) => sum + log.tokens_used, 0) || 0;

          return {
            userId: user.id,
            email: user.email,
            fullName: user.full_name || 'Unknown',
            totalInvoices: invoiceCount || 0,
            tokensUsed,
            subscriptionPlan: user.subscription_plan,
            createdAt: user.created_at
          };
        })
      );

      // Sort by tokens used
      usersWithStats.sort((a, b) => b.tokensUsed - a.tokensUsed);
      setTopUsers(usersWithStats);

    } catch (error) {
      console.error('Error fetching top users:', error);
    }
  };

  const fetchAIProviderStats = async () => {
    try {
      const { data: providerLogs } = await supabase
        .from('ai_provider_usage')
        .select('*');

      if (!providerLogs) return;

      // Group by provider
      const providerMap = new Map<string, any[]>();
      
      providerLogs.forEach(log => {
        if (!providerMap.has(log.provider_name)) {
          providerMap.set(log.provider_name, []);
        }
        providerMap.get(log.provider_name)!.push(log);
      });

      // Calculate stats for each provider
      const stats: AIProviderStat[] = [];
      
      providerMap.forEach((logs, provider) => {
        const totalRequests = logs.length;
        const successfulRequests = logs.filter(log => log.success).length;
        const successRate = (successfulRequests / totalRequests) * 100;
        
        const totalResponseTime = logs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0);
        const avgResponseTime = totalResponseTime / logs.length;
        
        const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);

        stats.push({
          provider,
          totalRequests,
          successRate,
          avgResponseTime,
          totalCost
        });
      });

      setAIProviderStats(stats);

    } catch (error) {
      console.error('Error fetching AI provider stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('admin.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('admin.subtitle')}
            </p>
          </div>
          <button
            onClick={() => {
              fetchSystemStats();
              fetchTopUsers();
              fetchAIProviderStats();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('admin.refreshData')}
          </button>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Total Users */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <Users className="w-8 h-8 text-blue-600" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('admin.cards.total')}</span>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalUsers}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{t('admin.cards.users')}</div>
              </div>
            </div>

            {/* Active Users */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <Activity className="w-8 h-8 text-green-600" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('admin.cards.sevenDays')}</span>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.activeUsers}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{t('admin.cards.activeUsers')}</div>
              </div>
            </div>

            {/* Total Invoices */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <Database className="w-8 h-8 text-purple-600" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('admin.cards.processed')}</span>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalInvoices}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{t('admin.cards.invoices')}</div>
              </div>
            </div>

            {/* Tokens Used */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <Zap className="w-8 h-8 text-yellow-600" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('admin.cards.total')}</span>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalTokensUsed.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{t('admin.cards.tokensUsed')}</div>
              </div>
            </div>

            {/* Revenue */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <DollarSign className="w-8 h-8 text-emerald-600" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('admin.cards.total')}</span>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${stats.totalRevenue.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{t('admin.cards.revenue')}</div>
              </div>
            </div>

            {/* Avg Processing Time */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <TrendingUp className="w-8 h-8 text-indigo-600" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('admin.cards.average')}</span>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(stats.avgProcessingTime / 1000).toFixed(1)}s
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{t('admin.cards.processingTime')}</div>
              </div>
            </div>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Users */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {t('admin.sections.topUsers')}
            </h2>
            <div className="space-y-3">
              {topUsers.map((user, index) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {user.fullName}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {user.email}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900 dark:text-white">
                      {user.tokensUsed} {t('admin.tokens')}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {user.totalInvoices} {t('admin.invoices')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Provider Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {t('admin.sections.aiProviderPerformance')}
            </h2>
            <div className="space-y-4">
              {aiProviderStats.map((provider) => (
                <div key={provider.provider} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Server className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white capitalize">
                        {provider.provider}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {provider.successRate >= 95 ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : provider.successRate >= 80 ? (
                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {provider.successRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-gray-600 dark:text-gray-400">{t('admin.providerStats.requests')}</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {provider.totalRequests}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 dark:text-gray-400">{t('admin.providerStats.avgTime')}</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {provider.avgResponseTime.toFixed(0)}ms
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 dark:text-gray-400">{t('admin.providerStats.cost')}</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        ${provider.totalCost.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        provider.successRate >= 95
                          ? 'bg-green-600'
                          : provider.successRate >= 80
                          ? 'bg-yellow-600'
                          : 'bg-red-600'
                      }`}
                      style={{ width: `${provider.successRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}