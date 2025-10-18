import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TokenDisplay } from '../contexts/TokenContext'; // NEW
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import InvoiceUpload from './invoice/InvoiceUpload';
import InvoiceList from './invoice/InvoiceList';
import ChatBot from './chat/ChatBot';
import Analytics from './analytics/Analytics';
import Settings from './settings/Settings';
import AdminDashboard from './dashboard/AdminDashboard'; // NEW
import { 
  LayoutDashboard, 
  Upload, 
  MessageSquare, 
  BarChart3, 
  Settings as SettingsIcon,
  Shield,
  LogOut 
} from 'lucide-react';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  React.useEffect(() => {
    const checkAdmin = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user?.id)
        .single();
      
      setIsAdmin(data?.is_admin || false);
    };
    
    if (user) checkAdmin();
  }, [user]);

  const navigation = [
    { id: 'overview', label: t('nav.overview'), icon: LayoutDashboard },
    { id: 'upload', label: t('nav.upload'), icon: Upload },
    { id: 'chat', label: t('nav.chat'), icon: MessageSquare },
    { id: 'analytics', label: t('nav.analytics'), icon: BarChart3 },
    { id: 'settings', label: t('nav.settings'), icon: SettingsIcon },
    ...(isAdmin ? [{ id: 'admin', label: t('nav.admin'), icon: Shield }] : [])
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.title')}
          </h1>
        </div>

        {/* NEW: Token Display */}
        <div className="px-6 pb-4">
          <TokenDisplay />
        </div>

        <nav className="px-4 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={signOut}
            className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{t('common.signOut')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'upload' && <InvoiceUpload />}
        {activeTab === 'chat' && <ChatBot />}
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'settings' && <Settings />}
        {activeTab === 'admin' && isAdmin && <AdminDashboard />}
      </main>
    </div>
  );
}

function OverviewTab() {
  const { t } = useLanguage();

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('dashboard.overview')}
      </h2>
      <InvoiceList />
    </div>
  );
}