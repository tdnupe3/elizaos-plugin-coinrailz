// Internationalization support for Coin Railz
export const supportedLanguages = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  ar: 'العربية',
  hi: 'हिन्दी',
} as const;

export type SupportedLanguage = keyof typeof supportedLanguages;

export const supportedCurrencies = {
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  EUR: { symbol: '€', name: 'Euro', locale: 'de-DE' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB' },
  JPY: { symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH' },
  CNY: { symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
  INR: { symbol: '₹', name: 'Indian Rupee', locale: 'hi-IN' },
  BRL: { symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
  MXN: { symbol: '$', name: 'Mexican Peso', locale: 'es-MX' },
  KRW: { symbol: '₩', name: 'South Korean Won', locale: 'ko-KR' },
  SAR: { symbol: 'ر.س', name: 'Saudi Riyal', locale: 'ar-SA' },
  AED: { symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE' },
} as const;

export type SupportedCurrency = keyof typeof supportedCurrencies;

// Translation strings organized by feature
export const translations = {
  en: {
    // Common
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      confirm: 'Confirm',
      back: 'Back',
      next: 'Next',
      save: 'Save',
      edit: 'Edit',
      delete: 'Delete',
      copy: 'Copy',
      copied: 'Copied to clipboard',
      retry: 'Retry',
      refresh: 'Refresh',
    },
    
    // Navigation
    nav: {
      sendMoney: 'Send Money',
      buySell: 'Buy/Sell',
      swap: 'Swap',
      portfolio: 'Portfolio',
      analytics: 'Analytics',
      referrals: 'Referrals',
      security: 'Security',
      settings: 'Settings',
      logout: 'Sign Out',
    },
    
    // Authentication
    auth: {
      signIn: 'Sign In',
      signOut: 'Sign Out',
      welcome: 'Welcome back',
      loginRequired: 'Please sign in to continue',
    },
    
    // Dashboard
    dashboard: {
      totalPortfolio: 'Total Portfolio',
      usdWallet: 'USD Wallet',
      cryptoValue: 'Crypto Value',
      recentTransactions: 'Recent Transactions',
      cryptoHoldings: 'Crypto Holdings',
      quickActions: 'Quick Actions',
    },
    
    // Transactions
    transactions: {
      amount: 'Amount',
      recipient: 'Recipient',
      description: 'Description',
      date: 'Date',
      status: 'Status',
      pending: 'Pending',
      completed: 'Completed',
      failed: 'Failed',
      transactionHistory: 'Transaction History',
      noTransactions: 'No transactions found',
    },
    
    // Security & MFA
    security: {
      twoFactor: 'Two-Factor Authentication',
      enableMfa: 'Enable MFA',
      disableMfa: 'Disable MFA',
      verifyCode: 'Verify Code',
      sendCode: 'Send Code',
      emailVerification: 'Email Verification',
      smsVerification: 'SMS Verification',
      securitySettings: 'Security Settings',
      trustedDevices: 'Trusted Devices',
    },
    
    // Crypto
    crypto: {
      bitcoin: 'Bitcoin',
      ethereum: 'Ethereum',
      solana: 'Solana',
      cardano: 'Cardano',
      polygon: 'Polygon',
      avalanche: 'Avalanche',
      chainlink: 'Chainlink',
      litecoin: 'Litecoin',
      dogecoin: 'Dogecoin',
      price: 'Price',
      change24h: '24h Change',
      marketCap: 'Market Cap',
      volume: 'Volume',
    },
    
    // Forms
    forms: {
      required: 'This field is required',
      invalidEmail: 'Invalid email address',
      invalidAmount: 'Invalid amount',
      minimumAmount: 'Minimum amount is',
      maximumAmount: 'Maximum amount is',
    },
    
    // Errors
    errors: {
      networkError: 'Network error. Please check your connection.',
      serverError: 'Server error. Please try again later.',
      unauthorized: 'You are not authorized to perform this action.',
      invalidCredentials: 'Invalid credentials',
      sessionExpired: 'Your session has expired. Please sign in again.',
    },
  },
  
  es: {
    common: {
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      back: 'Atrás',
      next: 'Siguiente',
      save: 'Guardar',
      edit: 'Editar',
      delete: 'Eliminar',
      copy: 'Copiar',
      copied: 'Copiado al portapapeles',
      retry: 'Reintentar',
      refresh: 'Actualizar',
    },
    
    nav: {
      sendMoney: 'Enviar Dinero',
      buySell: 'Comprar/Vender',
      swap: 'Intercambiar',
      portfolio: 'Portafolio',
      analytics: 'Analítica',
      referrals: 'Referencias',
      security: 'Seguridad',
      settings: 'Configuración',
      logout: 'Cerrar Sesión',
    },
    
    auth: {
      signIn: 'Iniciar Sesión',
      signOut: 'Cerrar Sesión',
      welcome: 'Bienvenido de vuelta',
      loginRequired: 'Por favor inicia sesión para continuar',
    },
    
    dashboard: {
      totalPortfolio: 'Portafolio Total',
      usdWallet: 'Billetera USD',
      cryptoValue: 'Valor Cripto',
      recentTransactions: 'Transacciones Recientes',
      cryptoHoldings: 'Tenencias Cripto',
      quickActions: 'Acciones Rápidas',
    },
    
    transactions: {
      amount: 'Cantidad',
      recipient: 'Destinatario',
      description: 'Descripción',
      date: 'Fecha',
      status: 'Estado',
      pending: 'Pendiente',
      completed: 'Completado',
      failed: 'Fallido',
      transactionHistory: 'Historial de Transacciones',
      noTransactions: 'No se encontraron transacciones',
    },
    
    security: {
      twoFactor: 'Autenticación de Dos Factores',
      enableMfa: 'Activar MFA',
      disableMfa: 'Desactivar MFA',
      verifyCode: 'Verificar Código',
      sendCode: 'Enviar Código',
      emailVerification: 'Verificación por Email',
      smsVerification: 'Verificación por SMS',
      securitySettings: 'Configuración de Seguridad',
      trustedDevices: 'Dispositivos de Confianza',
    },
    
    crypto: {
      bitcoin: 'Bitcoin',
      ethereum: 'Ethereum',
      solana: 'Solana',
      cardano: 'Cardano',
      polygon: 'Polygon',
      avalanche: 'Avalanche',
      chainlink: 'Chainlink',
      litecoin: 'Litecoin',
      dogecoin: 'Dogecoin',
      price: 'Precio',
      change24h: 'Cambio 24h',
      marketCap: 'Cap. Mercado',
      volume: 'Volumen',
    },
    
    forms: {
      required: 'Este campo es requerido',
      invalidEmail: 'Dirección de email inválida',
      invalidAmount: 'Cantidad inválida',
      minimumAmount: 'La cantidad mínima es',
      maximumAmount: 'La cantidad máxima es',
    },
    
    errors: {
      networkError: 'Error de red. Por favor verifica tu conexión.',
      serverError: 'Error del servidor. Por favor intenta más tarde.',
      unauthorized: 'No estás autorizado para realizar esta acción.',
      invalidCredentials: 'Credenciales inválidas',
      sessionExpired: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
    },
  },
  
  // Additional languages would follow the same pattern
  fr: {
    common: {
      loading: 'Chargement...',
      error: 'Erreur',
      success: 'Succès',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      back: 'Retour',
      next: 'Suivant',
      save: 'Sauvegarder',
      edit: 'Modifier',
      delete: 'Supprimer',
      copy: 'Copier',
      copied: 'Copié dans le presse-papier',
      retry: 'Réessayer',
      refresh: 'Actualiser',
    },
    // ... other translations
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
export type NestedTranslationKey<T> = T extends Record<string, any>
  ? { [K in keyof T]: T[K] extends Record<string, any> 
      ? `${K & string}.${NestedTranslationKey<T[K]> & string}`
      : K & string 
    }[keyof T]
  : never;

export type AllTranslationKeys = NestedTranslationKey<typeof translations.en>;

// Utility functions for formatting
export function formatCurrency(
  amount: number, 
  currency: SupportedCurrency = 'USD',
  language: SupportedLanguage = 'en'
): string {
  const currencyInfo = supportedCurrencies[currency];
  const locale = language === 'en' ? currencyInfo.locale : `${language}-${currency}`;
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  } catch {
    // Fallback to simple formatting
    return `${currencyInfo.symbol}${amount.toLocaleString()}`;
  }
}

export function formatNumber(
  num: number,
  language: SupportedLanguage = 'en'
): string {
  const locale = language === 'en' ? 'en-US' : language;
  return new Intl.NumberFormat(locale).format(num);
}

export function formatDate(
  date: Date,
  language: SupportedLanguage = 'en'
): string {
  const locale = language === 'en' ? 'en-US' : language;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(
  date: Date,
  language: SupportedLanguage = 'en'
): string {
  const locale = language === 'en' ? 'en-US' : language;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}