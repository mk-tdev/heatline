// Crew briefing for a day plan (the morning "toolbox talk"), in the crews' languages. Every
// number and time comes from the plan; the sentences are fixed. Draft translations: they need
// native-speaker review before a pilot, like the guardian templates.

import type { Language } from '@heatline/contracts';
import { formatClock } from '@heatline/contracts';
import type { DayPlan } from './dayplan';

type Line = 'hot' | 'mild' | 'heavy' | 'noHeavy' | 'water' | 'waterMild' | 'ban' | 'symptoms' | 'newWorkers';

const REST: Record<Language, { shade: string; 'cool-room': string }> = {
  en: { shade: 'in the shade', 'cool-room': 'in the cool room' },
  ar: { shade: 'في الظل', 'cool-room': 'في الغرفة المكيفة' },
  hi: { shade: 'छाँव में', 'cool-room': 'ठंडे कमरे में' },
  ur: { shade: 'سائے میں', 'cool-room': 'ٹھنڈے کمرے میں' },
  bn: { shade: 'ছায়ায়', 'cool-room': 'ঠান্ডা ঘরে' },
  ml: { shade: 'തണലിൽ', 'cool-room': 'തണുത്ത മുറിയിൽ' },
  tl: { shade: 'sa lilim', 'cool-room': 'sa malamig na silid' },
};

const TEXT: Record<Language, Record<Line, string>> = {
  en: {
    hot: '{date}. Dangerous heat from {from} to {to}.',
    mild: '{date}. Heat risk is low today.',
    heavy: 'Heavy work in the sun: no more than {n} minutes in each hour. Then rest {rest}.',
    noHeavy: 'No heavy work in the sun from {from} to {to}.',
    water: 'Drink one cup of water every 20 minutes.',
    waterMild: 'Keep drinking water through the shift.',
    ban: 'No work in the sun from 12:30 to 15:00.',
    symptoms: 'If you feel dizzy, nauseous or confused, stop work and tell someone at once.',
    newWorkers: 'New on site or back from leave? Tell the foreman. You get a shorter time in the heat.',
  },
  ar: {
    hot: '{date}. حرارة خطرة من {from} إلى {to}.',
    mild: '{date}. خطر الحرارة منخفض اليوم.',
    heavy: 'العمل الشاق تحت الشمس: لا يزيد عن {n} دقيقة في كل ساعة. بعدها استرح {rest}.',
    noHeavy: 'لا عمل شاق تحت الشمس من {from} إلى {to}.',
    water: 'اشرب كوب ماء كل 20 دقيقة.',
    waterMild: 'استمر في شرب الماء طوال الوردية.',
    ban: 'لا عمل تحت الشمس من 12:30 إلى 15:00.',
    symptoms: 'إذا شعرت بدوخة أو غثيان أو تشوش، توقف عن العمل وأخبر أحدًا فورًا.',
    newWorkers: 'جديد في الموقع أو عائد من إجازة؟ أخبر رئيس العمال. وقتك في الحر سيكون أقصر.',
  },
  hi: {
    hot: '{date}। {from} से {to} तक खतरनाक गर्मी।',
    mild: '{date}। आज गर्मी का खतरा कम है।',
    heavy: 'धूप में भारी काम: हर घंटे में {n} मिनट से ज़्यादा नहीं। फिर {rest} आराम करें।',
    noHeavy: '{from} से {to} तक धूप में भारी काम नहीं।',
    water: 'हर 20 मिनट में एक कप पानी पिएँ।',
    waterMild: 'पूरी शिफ़्ट में पानी पीते रहें।',
    ban: '12:30 से 15:00 तक धूप में कोई काम नहीं।',
    symptoms: 'चक्कर, मतली या उलझन महसूस हो तो काम रोकें और तुरंत किसी को बताएँ।',
    newWorkers: 'साइट पर नए हैं या छुट्टी से लौटे हैं? फ़ोरमैन को बताएँ। आपको गर्मी में कम समय काम करना है।',
  },
  ur: {
    hot: '{date}۔ {from} سے {to} تک خطرناک گرمی۔',
    mild: '{date}۔ آج گرمی کا خطرہ کم ہے۔',
    heavy: 'دھوپ میں بھاری کام: ہر گھنٹے میں {n} منٹ سے زیادہ نہیں۔ پھر {rest} آرام کریں۔',
    noHeavy: '{from} سے {to} تک دھوپ میں بھاری کام نہیں۔',
    water: 'ہر 20 منٹ بعد ایک کپ پانی پئیں۔',
    waterMild: 'پوری شفٹ میں پانی پیتے رہیں۔',
    ban: '12:30 سے 15:00 تک دھوپ میں کوئی کام نہیں۔',
    symptoms: 'چکر، متلی یا الجھن محسوس ہو تو کام روکیں اور فوراً کسی کو بتائیں۔',
    newWorkers: 'سائٹ پر نئے ہیں یا چھٹی سے واپس آئے ہیں؟ فورمین کو بتائیں۔ آپ کو گرمی میں کم وقت کام کرنا ہے۔',
  },
  bn: {
    hot: '{date}। {from} থেকে {to} পর্যন্ত বিপজ্জনক গরম।',
    mild: '{date}। আজ গরমের ঝুঁকি কম।',
    heavy: 'রোদে ভারী কাজ: প্রতি ঘণ্টায় {n} মিনিটের বেশি নয়। তারপর {rest} বিশ্রাম নিন।',
    noHeavy: '{from} থেকে {to} পর্যন্ত রোদে ভারী কাজ নয়।',
    water: 'প্রতি 20 মিনিটে এক কাপ পানি পান করুন।',
    waterMild: 'পুরো শিফটে পানি পান করতে থাকুন।',
    ban: '12:30 থেকে 15:00 পর্যন্ত রোদে কোনো কাজ নয়।',
    symptoms: 'মাথা ঘুরলে, বমি ভাব হলে বা বিভ্রান্ত লাগলে কাজ থামান এবং সঙ্গে সঙ্গে কাউকে জানান।',
    newWorkers: 'সাইটে নতুন বা ছুটি থেকে ফিরেছেন? ফোরম্যানকে জানান। আপনি গরমে কম সময় কাজ করবেন।',
  },
  ml: {
    hot: '{date}. {from} മുതൽ {to} വരെ അപകടകരമായ ചൂട്.',
    mild: '{date}. ഇന്ന് ചൂടിന്റെ അപകടസാധ്യത കുറവാണ്.',
    heavy: 'വെയിലത്ത് കഠിന ജോലി: ഓരോ മണിക്കൂറിലും {n} മിനിറ്റിൽ കൂടുതൽ വേണ്ട. പിന്നെ {rest} വിശ്രമിക്കുക.',
    noHeavy: '{from} മുതൽ {to} വരെ വെയിലത്ത് കഠിന ജോലി വേണ്ട.',
    water: 'ഓരോ 20 മിനിറ്റിലും ഒരു കപ്പ് വെള്ളം കുടിക്കുക.',
    waterMild: 'ഷിഫ്റ്റ് മുഴുവൻ വെള്ളം കുടിച്ചുകൊണ്ടിരിക്കുക.',
    ban: '12:30 മുതൽ 15:00 വരെ വെയിലത്ത് ജോലി വേണ്ട.',
    symptoms: 'തലകറക്കം, ഓക്കാനം, ആശയക്കുഴപ്പം എന്നിവ തോന്നിയാൽ ജോലി നിർത്തി ഉടൻ ആരോടെങ്കിലും പറയുക.',
    newWorkers: 'സൈറ്റിൽ പുതിയ ആളാണോ, അവധി കഴിഞ്ഞ് വന്നതാണോ? ഫോർമാനോട് പറയുക. നിങ്ങൾക്ക് ചൂടിൽ ജോലി ചെയ്യാനുള്ള സമയം കുറവായിരിക്കും.',
  },
  tl: {
    hot: '{date}. Mapanganib ang init mula {from} hanggang {to}.',
    mild: '{date}. Mababa ang panganib ng init ngayong araw.',
    heavy: 'Mabigat na trabaho sa ilalim ng araw: hindi hihigit sa {n} minuto bawat oras. Pagkatapos, magpahinga {rest}.',
    noHeavy: 'Walang mabigat na trabaho sa ilalim ng araw mula {from} hanggang {to}.',
    water: 'Uminom ng isang tasa ng tubig tuwing 20 minuto.',
    waterMild: 'Patuloy na uminom ng tubig sa buong shift.',
    ban: 'Walang trabaho sa ilalim ng araw mula 12:30 hanggang 15:00.',
    symptoms: 'Kung nahihilo, nasusuka o nalilito ka, huminto sa trabaho at sabihin agad sa iba.',
    newWorkers: 'Bago sa site o galing sa bakasyon? Sabihin sa foreman. Mas maikli ang oras mo sa init.',
  },
};

export const BRIEFING_LANGUAGES: Language[] = ['en', 'ar', 'hi', 'ur', 'bn', 'ml', 'tl'];

/** Which fixed lines apply to this plan, with their numbers. The same for every language. */
export function briefingFacts(plan: DayPlan): { line: Line; values: Record<string, string> }[] {
  const [, month, day] = plan.input.date.split('-');
  const date = `${day}/${month}`;
  const facts: { line: Line; values: Record<string, string> }[] = [];
  if (!plan.limited) {
    facts.push({ line: 'mild', values: { date } }, { line: 'waterMild', values: {} }, { line: 'symptoms', values: {} });
    // Workers not yet used to the heat can still be over their limit on a day that is mild for everyone else.
    if (plan.hours.some((h) => !h.banned && h.workNew.heavy < 60)) facts.push({ line: 'newWorkers', values: {} });
    return facts;
  }
  const span = { from: formatClock(plan.limited.from), to: formatClock(plan.limited.to) };
  facts.push({ line: 'hot', values: { date, ...span } });
  if (plan.tightestHeavy < 15) facts.push({ line: 'noHeavy', values: span });
  else facts.push({ line: 'heavy', values: { n: String(plan.tightestHeavy) } });
  facts.push({ line: 'water', values: {} });
  if (plan.seasonBan) facts.push({ line: 'ban', values: {} });
  facts.push({ line: 'symptoms', values: {} }, { line: 'newWorkers', values: {} });
  return facts;
}

export function briefing(plan: DayPlan, language: Language): string[] {
  return briefingFacts(plan).map(({ line, values }) => {
    let text = TEXT[language][line].replaceAll('{rest}', REST[language][plan.input.rest]);
    for (const [key, value] of Object.entries(values)) text = text.replaceAll(`{${key}}`, value);
    return text;
  });
}
