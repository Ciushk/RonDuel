import { defineRouting } from 'next-intl/routing';

import { SUPPORTED_LOCALE_CODES } from '../lib/locales';

export const routing = defineRouting({
  locales: SUPPORTED_LOCALE_CODES,
  defaultLocale: 'ro',
  localePrefix: 'always',
});
