import { getRequestConfig } from 'next-intl/server';

const locales = ['en', 'ar'] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && (locales as readonly string[]).includes(requested) ? requested : 'en';
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    timeZone: 'UTC',
  };
});
