import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TokenDisplay } from '../contexts/TokenContext'; // NEW
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import Header from './layout/Header';
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
  Shield
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [isAdmin, setIsAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <Header setSidebarOpen={setSidebarOpen} />

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 hidden lg:block">
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
      </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'upload' && <InvoiceUpload onUploadComplete={() => setActiveTab('overview')} />}
          {activeTab === 'chat' && <ChatBot />}
          {activeTab === 'analytics' && <Analytics />}
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'admin' && isAdmin && <AdminDashboard />}
        </main>
      </div>
    </div>
  );
}

function OverviewTab() {
  const { t } = useTranslation();

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('dashboard.overview')}
      </h2>
      <InvoiceList />
    </div>
  );
}