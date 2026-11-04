import { create } from "zustand";

export type Language = "id" | "en";

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") return "id";
  const saved = localStorage.getItem("scada.language");
  if (saved === "id" || saved === "en") return saved;
  return "id";
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: getInitialLanguage(),
  setLanguage: (language: Language) => {
    localStorage.setItem("scada.language", language);
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
    set({ language });
  },
  toggleLanguage: () =>
    set((state) => {
      const next: Language = state.language === "id" ? "en" : "id";
      localStorage.setItem("scada.language", next);
      if (typeof document !== "undefined") {
        document.documentElement.lang = next;
      }
      return { language: next };
    }),
}));
