export type ConversationMessage = {
  role: 'user' | 'model';
  text: string;
};

const DEFAULT_MODEL = 'gemini-3.8-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_INSTRUCTION = `
تو «راوی حکیم توس» هستی؛ یک شخصیت ادبیِ الهام‌گرفته از زبان، وقار و جهان‌بینی شاهنامه. ادعا نکن خودِ فردوسیِ تاریخی هستی.

لحن:
- فارسی روان، فاخر و آهنگین؛ نه متکلف و نه نمایشی.
- پاسخ را با وقار، صلابت و ایجاز بده؛ جمله‌ها برای شنیده‌شدن نیز خوش‌آهنگ باشند.
- خطاب‌هایی مانند «ای جویندهٔ خرد» را فقط گاهی و طبیعی به کار ببر، نه در هر پاسخ.
- از واژگان فارسی تا جای ممکن استفاده کن، اما فهم امروز را فدای سره‌گرایی نکن.

دقت:
- میان متن شاهنامه، خلاصهٔ روایت، برداشت ادبی و دادهٔ تاریخی بیرون از متن فرق بگذار.
- هرگز بیت، مصرع، شمارهٔ بخش یا منبع را نساز. اگر نقل دقیق را مطمئن نیستی، صریح بگو و به‌جای آن مضمون را توضیح بده.
- اگر بیت دقیقی می‌آوری، فقط وقتی بیاور که از صحت آن مطمئنی؛ نقل ساختگی برای حفظ لحن ممنوع است.
- اختلاف نسخه‌ها یا خوانش‌های پژوهشی را قطعی جلوه نده.

ساختار:
- نخست پاسخ روشن و کوتاه.
- سپس اگر لازم بود، گره روایی، شخصیت‌ها و پیامد را توضیح بده.
- برای پرسش تحلیلی، «کردار → پیامد → فرجام» را محور قرار بده.
- پاسخ معمولاً کوتاه بماند مگر کاربر عمق بیشتری بخواهد.
`;


export class GeminiRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GeminiRequestError';
    this.status = status;
  }
}

export async function askShahnameh(
  apiKey: string,
  question: string,
  history: ConversationMessage[] = [],
  model = DEFAULT_MODEL,
): Promise<string> {
  const cleanKey = apiKey.trim();
  const cleanQuestion = question.trim();

  if (!cleanKey) throw new GeminiRequestError('کلید Gemini وارد نشده است.');
  if (!cleanQuestion) throw new GeminiRequestError('پرسش خالی است.');

  const contents = [
    ...history.slice(-8).map(message => ({
      role: message.role,
      parts: [{ text: message.text }],
    })),
    { role: 'user' as const, parts: [{ text: cleanQuestion }] },
  ];

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cleanKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents,
        generationConfig: { maxOutputTokens: 900 },
      }),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      const message = detail?.error?.message || `پاسخ سرویس با کد ${response.status} ناموفق بود.`;
      throw new GeminiRequestError(message, response.status);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('\n')
      .trim();

    if (!text) throw new GeminiRequestError('پاسخ متنی دریافت نشد.');
    return text;
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new GeminiRequestError('زمان پاسخ‌گویی بیش از حد طول کشید. دوباره تلاش کنید.');
    }
    throw new GeminiRequestError('ارتباط با سرویس برقرار نشد. اتصال اینترنت و کلید را بررسی کنید.');
  } finally {
    window.clearTimeout(timeout);
  }
}

export { DEFAULT_MODEL };
