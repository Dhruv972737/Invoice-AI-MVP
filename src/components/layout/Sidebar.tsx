import React from 'react';
import {
  Home,
  Upload,
  FileText,
  MessageSquare,
  BarChart3,
  Settings,
  X,
  Brain
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Sidebar({ activeView, setActiveView, sidebarOpen, setSidebarOpen }: SidebarProps) {
  const { t } = useTranslation();

  const navigation = [
    { name: t('nav.dashboard'), icon: Home, view: 'dashboard' },
    { name: t('nav.uploadInvoice'), icon: Upload, view: 'upload' },
    { name: t('nav.allInvoices'), icon: FileText, view: 'invoices' },
    { name: t('nav.aiAssistant'), icon: MessageSquare, view: 'chat' },
    { name: t('nav.analytics'), icon: BarChart3, view: 'analytics' },
    { name: t('nav.settings'), icon: Settings, view: 'settings' },
  ];
  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden bg-gray-600/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('common.appName')}</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="mt-8 px-4 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.view;
            
            return (
              <button
                key={item.name}
                onClick={() => {
                  setActiveView(item.view);
                  setSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors group
                  ${isActive 
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'}`} />
                {item.name}
              </button>
            );
          })}
        </nav>

      </div>
    </>
  );
}