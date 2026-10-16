import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const vazirmatn = localFont({
  src: '../public/fonts/Vazirmatn.woff2',
  variable: '--font-vazirmatn',
  display: 'swap',
  weight: '100 900',
});

export const viewport: Viewport = {
  themeColor: '#090b09',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://sunaria.si'),
  title: 'شاهنامه — خوانش، روایت، خرد',
  description: 'یک نسخهٔ مدرن و فارسی برای ورود به روایت‌ها، چهره‌ها، درون‌مایه‌ها و واژه‌های شاهنامهٔ فردوسی.',
  applicationName: 'شاهنامه',
  keywords: ['شاهنامه', 'فردوسی', 'رستم', 'سیاوش', 'ادبیات فارسی', 'حماسهٔ ایرانی'],
  authors: [{ name: 'Sunaria' }],
  alternates: { canonical: '/shahnameh-lite/' },
  openGraph: {
    title: 'شاهنامه — یک کتاب هزارساله، زنده در دست تو',
    description: 'روایت‌ها، چهره‌ها، واژه‌ها و پرسش‌های بزرگ شاهنامه در یک تجربهٔ خواندنی و مدرن.',
    type: 'website',
    locale: 'fa_IR',
    url: '/shahnameh-lite/',
  },
  twitter: {
    card: 'summary',
    title: 'شاهنامه — خوانش، روایت، خرد',
    description: 'یک تجربهٔ مدرن فارسی برای ورود به جهان شاهنامه.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl" className={vazirmatn.variable}><body>{children}</body></html>;
}
