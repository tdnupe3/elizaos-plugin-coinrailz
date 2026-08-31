import { useState, useEffect, createContext, useContext } from 'react';
import { 
  translations, 
  type SupportedLanguage, 
  type SupportedCurrency,
  formatCurrency as formatCurrencyUtil,
  formatNumber as formatNumberUtil,
  formatDate as formatDateUtil,
  formatDateTime as formatDateTimeUtil
} from '@shared/i18n';

interface I18nContext {
  language: SupportedLanguage;
  currency: SupportedCurrency;
  setLanguage: (language: SupportedLanguage) => void;
  setCurrency: (currency: SupportedCurrency) => void;
  t: (key: string) => string;
  formatCurrency: (amount: number, currency?: SupportedCurrency) => string;
  formatNumber: (num: number) => string;
  formatDate: (date: Date) => string;
  formatDateTime: (date: Date) => string;
}

export const I18nContext = createContext<I18nContext | null>(null);

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export function useI18nProvider() {
  const showLanguageConfirmation = (detectedLanguage: SupportedLanguage) => {
    window.dispatchEvent(new CustomEvent("coin-railz-language-detected", {
      detail: { language: detectedLanguage },
    }));
  };
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    // Check if user has explicitly set a language (overrides auto-detection)
    const userOverride = localStorage.getItem('coin-railz-language-override');
    
    // Check localStorage for saved preference
    const saved = localStorage.getItem('coin-railz-language');
    if (saved && saved in translations) {
      return saved as SupportedLanguage;
    }
    
    // Only auto-detect if user hasn't explicitly chosen a language
    if (!userOverride) {
      // Try to detect from browser, but be conservative
      const browserLang = navigator.language.split('-')[0] as SupportedLanguage;
      if (browserLang in translations) {
        // Show language confirmation for auto-detected languages (except English)
        if (browserLang !== 'en') {
          setTimeout(() => {
            showLanguageConfirmation(browserLang);
          }, 2000); // Show after 2 seconds
        }
        return browserLang;
      }
    }
    
    // Default to English if detection fails or user has overridden
    return 'en';
  });

  const [currency, setCurrencyState] = useState<SupportedCurrency>(() => {
    // Check localStorage first
    const saved = localStorage.getItem('coin-railz-currency');
    if (saved) {
      return saved as SupportedCurrency;
    }
    
    // Try to detect from browser/language
    const currencyMap: Record<string, SupportedCurrency> = {
      'en': 'USD',
      'es': 'USD', // Could be MXN for Mexico
      'fr': 'EUR',
      'de': 'EUR',
      'pt': 'BRL',
      'zh': 'CNY',
      'ja': 'JPY',
      'ko': 'KRW',
      'ar': 'SAR',
      'hi': 'INR',
    };
    
    return currencyMap[language] || 'USD';
  });

  const setLanguage = (newLanguage: SupportedLanguage) => {
    setLanguageState(newLanguage);
    localStorage.setItem('coin-railz-language', newLanguage);
  };

  const setCurrency = (newCurrency: SupportedCurrency) => {
    setCurrencyState(newCurrency);
    localStorage.setItem('coin-railz-currency', newCurrency);
  };

  // Translation function with nested key support
  const t = (key: string): string => {
    const keys = key.split('.');
    let value: unknown = translations[language as keyof typeof translations] ?? translations.en;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        // Fallback to English if key not found
        let fallback: unknown = translations.en;
        for (const fk of keys) {
          if (fallback && typeof fallback === 'object' && fk in fallback) {
            fallback = (fallback as Record<string, unknown>)[fk];
          } else {
            return key; // Return key if not found in fallback either
          }
        }
        return typeof fallback === "string" ? fallback : key;
      }
    }
    
    return typeof value === 'string' ? value : key;
  };

  const formatCurrency = (amount: number, curr?: SupportedCurrency) => {
    return formatCurrencyUtil(amount, curr || currency, language);
  };

  const formatNumber = (num: number) => {
    return formatNumberUtil(num, language);
  };

  const formatDate = (date: Date) => {
    return formatDateUtil(date, language);
  };

  const formatDateTime = (date: Date) => {
    return formatDateTimeUtil(date, language);
  };

  return {
    language,
    currency,
    setLanguage,
    setCurrency,
    t,
    formatCurrency,
    formatNumber,
    formatDate,
    formatDateTime,
  };
}