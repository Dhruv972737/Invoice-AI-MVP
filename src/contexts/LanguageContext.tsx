import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'en' | 'ar' | 'de';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Detect browser language
const detectBrowserLanguage = (): Language => {
  if (typeof window === 'undefined') return 'en';

  const browserLang = navigator.language.toLowerCase();

  if (browserLang.startsWith('ar')) return 'ar';
  if (browserLang.startsWith('de')) return 'de';
  return 'en'; // Default to English
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('language') as Language;
      if (saved && ['en', 'ar', 'de'].includes(saved)) {
        return saved;
      }
      // Detect browser language on first visit
      return detectBrowserLanguage();
    }
    return 'en';
  });

  // Import translations dynamically
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const module = await import(`../locales/${language}.ts`);
        setTranslations(module.default);
      } catch (error) {
        console.error(`Failed to load translations for ${language}:`, error);
        // Fallback to English
        const fallback = await import('../locales/en.ts');
        setTranslations(fallback.default);
      }
    };

    loadTranslations();
  }, [language]);

  useEffect(() => {
    // Update HTML attributes for language and direction
    const root = document.documentElement;
    root.setAttribute('lang', language);
    root.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');

    // Save to localStorage
    localStorage.setItem('language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    if (['en', 'ar', 'de'].includes(lang)) {
      setLanguageState(lang);
    }
  };

  // Translation function with fallback
  const t = (key: string): string => {
    return translations[key] || key;
  };

  const isRTL = language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
