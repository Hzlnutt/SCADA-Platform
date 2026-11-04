import { useLanguageStore, type Language } from "../store/language.store";
import { translations } from "./translations";

export const useTranslation = () => {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const toggleLanguage = useLanguageStore((s) => s.toggleLanguage);

  const t = (path: string, fallback?: string): string => {
    const keys = path.split(".");
    let current: any = translations[language];
    for (const k of keys) {
      if (!current || typeof current !== "object") {
        return fallback ?? path;
      }
      current = current[k];
    }
    return typeof current === "string" ? current : (fallback ?? path);
  };

  return { t, language, setLanguage, toggleLanguage };
};
export type { Language };
