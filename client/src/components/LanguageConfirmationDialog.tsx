import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Globe, Check, X } from "lucide-react";
import { supportedLanguages, type SupportedLanguage } from "@shared/i18n";

interface LanguageConfirmationDialogProps {
  isOpen: boolean;
  detectedLanguage: SupportedLanguage;
  onConfirm: () => void;
  onSwitchToEnglish: () => void;
  onClose: () => void;
}

export default function LanguageConfirmationDialog({
  isOpen,
  detectedLanguage,
  onConfirm,
  onSwitchToEnglish,
  onClose,
}: LanguageConfirmationDialogProps) {
  const detectedLanguageName = supportedLanguages[detectedLanguage];

  // Show confirmation in both the detected language and English
  const confirmationTexts = {
    title: {
      detected: getLocalizedText(detectedLanguage, 'languageDetected'),
      english: 'Language Detected'
    },
    description: {
      detected: getLocalizedText(detectedLanguage, 'languageConfirmDescription', detectedLanguageName),
      english: `We detected your browser language as ${detectedLanguageName}. Would you like to continue in this language or switch to English?`
    },
    continue: {
      detected: getLocalizedText(detectedLanguage, 'continueInLanguage', detectedLanguageName),
      english: `Continue in ${detectedLanguageName}`
    },
    switchToEnglish: {
      detected: getLocalizedText(detectedLanguage, 'switchToEnglish'),
      english: 'Switch to English'
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <div>
              <div>{confirmationTexts.title.detected}</div>
              <div className="text-sm font-normal text-gray-500">
                {confirmationTexts.title.english}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <div>{confirmationTexts.description.detected}</div>
            <div className="text-sm text-gray-500 italic">
              {confirmationTexts.description.english}
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onSwitchToEnglish}
            className="w-full sm:w-auto"
          >
            <X className="w-4 h-4 mr-2" />
            <div>
              <div>{confirmationTexts.switchToEnglish.detected}</div>
              <div className="text-xs text-gray-500">
                {confirmationTexts.switchToEnglish.english}
              </div>
            </div>
          </Button>
          
          <Button
            onClick={onConfirm}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
          >
            <Check className="w-4 h-4 mr-2" />
            <div>
              <div>{confirmationTexts.continue.detected}</div>
              <div className="text-xs text-blue-100">
                {confirmationTexts.continue.english}
              </div>
            </div>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to get localized text (simplified for key phrases)
function getLocalizedText(language: SupportedLanguage, key: string, ...args: string[]): string {
  const texts: Record<string, Record<string, string>> = {
    es: {
      languageDetected: 'Idioma Detectado',
      languageConfirmDescription: `Detectamos que tu idioma del navegador es ${args[0]}. ¿Te gustaría continuar en este idioma o cambiar al inglés?`,
      continueInLanguage: `Continuar en ${args[0]}`,
      switchToEnglish: 'Cambiar a Inglés'
    },
    fr: {
      languageDetected: 'Langue Détectée',
      languageConfirmDescription: `Nous avons détecté que la langue de votre navigateur est ${args[0]}. Souhaitez-vous continuer dans cette langue ou passer à l'anglais?`,
      continueInLanguage: `Continuer en ${args[0]}`,
      switchToEnglish: 'Passer à l\'anglais'
    },
    de: {
      languageDetected: 'Sprache Erkannt',
      languageConfirmDescription: `Wir haben erkannt, dass Ihre Browsersprache ${args[0]} ist. Möchten Sie in dieser Sprache fortfahren oder zu Englisch wechseln?`,
      continueInLanguage: `Weiter in ${args[0]}`,
      switchToEnglish: 'Zu Englisch wechseln'
    },
    pt: {
      languageDetected: 'Idioma Detectado',
      languageConfirmDescription: `Detectamos que o idioma do seu navegador é ${args[0]}. Gostaria de continuar neste idioma ou mudar para o inglês?`,
      continueInLanguage: `Continuar em ${args[0]}`,
      switchToEnglish: 'Mudar para Inglês'
    },
    zh: {
      languageDetected: '检测到语言',
      languageConfirmDescription: `我们检测到您的浏览器语言是${args[0]}。您希望继续使用此语言还是切换到英语？`,
      continueInLanguage: `继续使用${args[0]}`,
      switchToEnglish: '切换到英语'
    },
    ja: {
      languageDetected: '言語が検出されました',
      languageConfirmDescription: `ブラウザの言語が${args[0]}であることを検出しました。この言語で続行しますか、それとも英語に切り替えますか？`,
      continueInLanguage: `${args[0]}で続行`,
      switchToEnglish: '英語に切り替え'
    },
    ko: {
      languageDetected: '언어 감지됨',
      languageConfirmDescription: `브라우저 언어가 ${args[0]}인 것을 감지했습니다. 이 언어로 계속하시겠습니까, 아니면 영어로 전환하시겠습니까?`,
      continueInLanguage: `${args[0]}로 계속`,
      switchToEnglish: '영어로 전환'
    },
    ar: {
      languageDetected: 'تم اكتشاف اللغة',
      languageConfirmDescription: `لقد اكتشفنا أن لغة المتصفح الخاص بك هي ${args[0]}. هل تود المتابعة بهذه اللغة أم التبديل إلى الإنجليزية؟`,
      continueInLanguage: `متابعة باللغة ${args[0]}`,
      switchToEnglish: 'التبديل إلى الإنجليزية'
    },
    hi: {
      languageDetected: 'भाषा का पता चला',
      languageConfirmDescription: `हमने पाया है कि आपके ब्राउज़र की भाषा ${args[0]} है। क्या आप इस भाषा में जारी रखना चाहते हैं या अंग्रेजी में बदलना चाहते हैं?`,
      continueInLanguage: `${args[0]} में जारी रखें`,
      switchToEnglish: 'अंग्रेजी में बदलें'
    }
  };

  return texts[language]?.[key] || key;
}