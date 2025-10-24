import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Shield,
  Bell,
  Moon,
  Sun,
  Globe,
  Download,
  Trash2,
  Eye,
  Save,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../ui/LoadingSpinner';
import { SubscriptionPlans, TokenPurchase } from '../../contexts/TokenContext';
import { CreditCard } from 'lucide-react';

interface LoginHistoryItem {
  id: string;
  login_method: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Profile settings
  const [profile, setProfile] = useState({
    full_name: user?.user_metadata?.full_name || '',
    email: user?.email || '',
  });
  
  // Notification settings
  const [notifications, setNotifications] = useState({
    email: true,
    processing: true,
    security: true,
    marketing: false
  });

  useEffect(() => {
    if (user) {
      fetchLoginHistory();
      loadUserPreferences();
    }
  }, [user]);

  const fetchLoginHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('login_history')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLoginHistory(data || []);
    } catch (error) {
      console.error('Error fetching login history:', error);
    }
  };

  const loadUserPreferences = () => {
    // Load from localStorage or API
    const saved = localStorage.getItem(`user_prefs_${user!.id}`);
    if (saved) {
      const prefs = JSON.parse(saved);
      setNotifications(prefs.notifications || notifications);
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: profile.full_name }
      });

      if (error) throw error;

      showToast('success', t('settings.toast.profileUpdated.title'), t('settings.toast.profileUpdated.message'));
    } catch (error: any) {
      showToast('error', t('settings.toast.updateFailed'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveNotifications = () => {
    const prefs = { notifications };
    localStorage.setItem(`user_prefs_${user!.id}`, JSON.stringify(prefs));
    showToast('success', t('settings.toast.settingsSaved.title'), t('settings.toast.settingsSaved.message'));
  };

  const exportData = async () => {
    try {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user!.id);

      if (error) throw error;

      const exportData = {
        profile: {
          email: user?.email,
          full_name: user?.user_metadata?.full_name,
          created_at: user?.created_at
        },
        invoices: invoices.map(inv => ({
          ...inv,
          file_url: undefined // Remove file URLs for privacy
        })),
        loginHistory,
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-ai-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('success', t('settings.toast.dataExported.title'), t('settings.toast.dataExported.message'));
    } catch (error: any) {
      showToast('error', t('settings.toast.exportFailed'), error.message);
    }
  };

  const deleteAccount = async () => {
    try {
      // Delete user data
      await supabase.from('invoices').delete().eq('user_id', user!.id);
      await supabase.from('login_history').delete().eq('user_id', user!.id);

      // Note: Supabase doesn't support account deletion via JS client
      // In production, this would trigger a server-side function

      showToast('success', t('settings.toast.accountDeleted.title'), t('settings.toast.accountDeleted.message'));
      await signOut();
    } catch (error: any) {
      showToast('error', t('settings.toast.deletionFailed'), error.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('settings.title')}</h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* Profile Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('settings.sections.profile')}</h3>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('settings.profile.fullName')}
            </label>
            <input
              type="text"
              value={profile.full_name}
              onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('settings.profile.emailAddress')}
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('settings.profile.emailNote')}
            </p>
          </div>
          <div className="pt-4">
            <button
              onClick={saveProfile}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? <LoadingSpinner size="sm" className="mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {t('common.saveChanges')}
            </button>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            {theme === 'light' ? (
              <Sun className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" />
            ) : (
              <Moon className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
            )}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('settings.sections.appearance')}</h3>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">{t('settings.appearance.theme')}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('settings.appearance.themeDesc')}
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-4 h-4 mr-2" />
                  {t('common.dark')}
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 mr-2" />
                  {t('common.light')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Bell className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('settings.sections.notifications')}</h3>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {[
            { key: 'email', label: t('settings.notifications.email.label'), desc: t('settings.notifications.email.desc') },
            { key: 'processing', label: t('settings.notifications.processing.label'), desc: t('settings.notifications.processing.desc') },
            { key: 'security', label: t('settings.notifications.security.label'), desc: t('settings.notifications.security.desc') },
            { key: 'marketing', label: t('settings.notifications.marketing.label'), desc: t('settings.notifications.marketing.desc') }
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">{label}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications[key as keyof typeof notifications]}
                  onChange={(e) => setNotifications(prev => ({ 
                    ...prev, 
                    [key]: e.target.checked 
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
          <div className="pt-4">
            <button
              onClick={saveNotifications}
              className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
            >
              <Save className="w-4 h-4 mr-2" />
              {t('settings.savePreferences')}
            </button>
          </div>
        </div>
      </div>

      {/* Login History */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('settings.sections.loginActivity')}</h3>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {loginHistory.map((login) => (
              <div key={login.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white dark:bg-gray-600 rounded-lg">
                    <Globe className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {login.login_method} {t('settings.login.login')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(login.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {login.ip_address || t('settings.login.unknownIp')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Subscription Plans */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('settings.sections.subscription')}</h3>
            </div>
          </div>
          <div className="p-6">
            <SubscriptionPlans />
          </div>
        </div>

      {/* Purchase Tokens */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <TokenPurchase />
          </div>
      </div>

      {/* Data Management */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Download className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('settings.sections.dataManagement')}</h3>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">{t('settings.dataManagement.exportData.label')}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('settings.dataManagement.exportData.desc')}
              </p>
            </div>
            <button
              onClick={exportData}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              <Download className="w-4 h-4 mr-2" />
              {t('common.export')}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 border border-red-200 dark:border-red-600 rounded-lg bg-red-50 dark:bg-red-900/20">
            <div>
              <h4 className="text-sm font-medium text-red-900 dark:text-red-100">{t('settings.dataManagement.deleteAccount.label')}</h4>
              <p className="text-sm text-red-700 dark:text-red-300">
                {t('settings.dataManagement.deleteAccount.desc')}
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('common.delete')}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowDeleteConfirm(false)}></div>
            
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                      {t('settings.deleteConfirm.title')}
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('settings.deleteConfirm.message')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={deleteAccount}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {t('common.delete')}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}