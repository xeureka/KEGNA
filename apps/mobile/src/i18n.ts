import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { amharic } from "./constants/translations";
import extendedTranslations from "./constants/extendedTranslations";

i18n.use(initReactI18next).init({
	lng: "en",
	fallbackLng: "en",
	keySeparator: false,
	interpolation: { escapeValue: false },
	resources: {
		en: { translation: {} },
		am: { translation: { ...amharic, ...extendedTranslations } },
	},
});

export default i18n;
