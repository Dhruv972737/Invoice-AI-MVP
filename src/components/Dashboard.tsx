import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import DashboardHome from './dashboard/DashboardHome';
import InvoiceUpload from './invoice/InvoiceUpload';
import InvoiceList from './invoice/InvoiceList';
import ChatBot from './chat/ChatBot';
import Analytics from './analytics/Analytics';
import Settings from './settings/Settings';

type ActiveView = 'dashboard' | 'upload' | 'invoices' | 'chat' | 'analytics' | 'settings';

export default function Dashboard() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardHome setActiveView={setActiveView} />;
      case 'upload':
        return <InvoiceUpload onUploadComplete={() => setActiveView('invoices')} />;
      case 'invoices':
        return <InvoiceList />;
      case 'chat':
        return <ChatBot />;
      case 'analytics':
        return <Analytics />;
      case 'settings':
        return <Settings />;
      default:
        return <DashboardHome setActiveView={setActiveView} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header setSidebarOpen={setSidebarOpen} />
        
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 lg:p-8">
            {renderActiveView()}
          </div>
        </main>
      </div>
    </div>
  );
}