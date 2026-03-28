// Language Context - App-wide language management
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, t, Translations, translations } from '../i18n';

const LANGUAGE_KEY = 'ndeip_language';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: keyof Translations, variables?: Record<string, string | number>) => string;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: async () => {},
  t: (key) => String(key),
  isLoading: true,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLanguage();
  }, []);

  async function loadLanguage() {
    try {
      const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedLang && (savedLang === 'en' || savedLang === 'sn' || savedLang === 'nd')) {
        setLanguageState(savedLang as Language);
      }
    } catch (error) {
      console.error('Load language error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function setLanguage(lang: Language) {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
      setLanguageState(lang);
    } catch (error) {
      console.error('Save language error:', error);
    }
  }

  function translate(key: keyof Translations, variables?: Record<string, string | number>): string {
    return t(language, key, variables);
  }

  return (
    <LanguageContext.Provider value={{ 
      language, 
      setLanguage, 
      t: translate,
      isLoading,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}


