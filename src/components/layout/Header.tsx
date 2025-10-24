import React from 'react';
import { Menu, Bell, Sun, Moon, User, LogOut, Languages } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { signOut } from '../../lib/supabase';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

export default function Header({ setSidebarOpen }: HeaderProps) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [showLanguageMenu, setShowLanguageMenu] = React.useState(false);

  const language = i18n.language;
  const setLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const handleSignOut = React.useCallback(async () => {
    try {
      await signOut();
      // Force reload to clear all state
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, []);

  const languages = [
    { code: 'en' as const, name: 'English', flag: '🇬🇧' },
    { code: 'ar' as const, name: 'العربية', flag: '🇸🇦' },
    { code: 'de' as const, name: 'Deutsch', flag: '🇩🇪' },
  ];

  const currentLanguage = languages.find(lang => lang.code === language);

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between h-full px-4 md:px-6 lg:px-8">
        <div className="flex items-center">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="hidden lg:block">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {t('common.welcome')}, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
              title={t('common.language')}
            >
              <Languages className="w-5 h-5" />
              <span className="text-sm font-medium hidden md:inline">{currentLanguage?.flag}</span>
            </button>

            {showLanguageMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code);
                      setShowLanguageMenu(false);
                    }}
                    className={`w-full flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      language === lang.code
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span className="mr-3 text-lg">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            title={theme === 'light' ? t('common.darkMode') : t('common.lightMode')}
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>

          {/* Sign Out Button - Now visible in header */}
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title={t('common.signOut')}
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden md:inline text-sm font-medium">{t('common.signOut')}</span>
          </button>

          {/* User Info (simplified - no dropdown) */}
          <div className="hidden lg:flex items-center space-x-3 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase()}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.email}
              </p>
            </div>
          </div>

          {/* Mobile: Just avatar */}
          <div className="lg:hidden">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}