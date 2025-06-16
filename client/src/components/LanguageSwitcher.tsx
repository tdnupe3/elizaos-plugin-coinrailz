import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Globe, Check } from "@/lib/icons";
import { supportedLanguages, type SupportedLanguage } from "@shared/i18n";

interface LanguageSwitcherProps {
  currentLanguage: SupportedLanguage;
  onLanguageChange: (language: SupportedLanguage) => void;
  compact?: boolean;
}

export default function LanguageSwitcher({ 
  currentLanguage, 
  onLanguageChange, 
  compact = false 
}: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getCurrentLanguageName = () => {
    return supportedLanguages[currentLanguage] || 'English';
  };

  const handleLanguageSelect = (language: SupportedLanguage) => {
    onLanguageChange(language);
    setIsOpen(false);
    
    // Store the user's explicit choice
    localStorage.setItem('coin-railz-language-override', 'true');
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size={compact ? "sm" : "default"}
          className="flex items-center space-x-2"
        >
          <Globe className="w-4 h-4" />
          {!compact && <span>{getCurrentLanguageName()}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {Object.entries(supportedLanguages).map(([code, name]) => (
          <DropdownMenuItem
            key={code}
            onClick={() => handleLanguageSelect(code as SupportedLanguage)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span>{name}</span>
            {currentLanguage === code && (
              <Check className="w-4 h-4 text-blue-600" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}