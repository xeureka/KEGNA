import { createContext, useContext } from "react";
import type { Language } from "../types";

export type { Language };

export const LanguageContext = createContext<{
	language: Language;
	setLanguage: (language: Language) => void;
}>({
	language: "EN",
	setLanguage: () => undefined,
});

export const useLanguage = () => useContext(LanguageContext);

export default LanguageContext;
