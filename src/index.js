
export default {
  async fetch(request, env, ctx) {
    if (request.method!== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // استفاده از چندین منبع برای اطمینان از پایداری
    const sources =;

    try {
      // دریافت همزمان اطلاعات از تمامی منابع
      const responses = await Promise.all(sources.map(url => fetch(url).catch(() => null)));
      let allProxies =;

      for (const res of responses) {
        if (res && res.ok) {
          const text = await res.text();
          const validLines = text.split('\n').filter(line => line.length > 5);
          allProxies.push(...validLines);
        }
      }

      // حذف پروکسی‌های تکراری
      const uniqueProxies =;
      
      if (uniqueProxies.length === 0) {
          return new Response('No valid proxies found.', { status: 503 });
      }
      
      // تبدیل خروجی به فرمت استاندارد Base64 برای کلاینت‌ها
      const base64Data = btoa(uniqueProxies.join('\n'));

      return new Response(base64Data, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=1800' // کش کردن نتایج برای ۳۰ دقیقه
        }
      });
    } catch (err) {
      return new Response('Error fetching proxies', { status: 500 });
    }
  }
};
