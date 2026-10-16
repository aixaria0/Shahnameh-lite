import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return {
    name: 'شاهنامه — خوانش، روایت، خرد',
    short_name: 'شاهنامه',
    description: 'روایت‌ها، چهره‌ها، درون‌مایه‌ها و واژه‌های شاهنامهٔ فردوسی.',
    start_url: `${basePath || '/'}`,
    scope: `${basePath || '/'}`,
    display: 'standalone',
    background_color: '#090b09',
    theme_color: '#090b09',
    lang: 'fa',
    dir: 'rtl',
  };
}
