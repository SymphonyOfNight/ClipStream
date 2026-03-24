import { zh } from './zh';
import { en } from './en';

export const i18n = {
  zh,
  en,
};

export type Language = keyof typeof i18n;
