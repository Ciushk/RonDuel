import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    requested && routing.locales.includes(requested as any) ? requested : routing.defaultLocale;

  let messages;
  try {
    messages = (await import(`../messages/${locale}.json`)).default;
  } catch {
    try {
      messages = (await import('../messages/en.json')).default;
    } catch {
      messages = (await import('../messages/ro.json')).default;
    }
  }

  return {
    locale,
    messages,
  };
});
