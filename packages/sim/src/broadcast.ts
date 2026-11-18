// Crew broadcasts for site-watch alerts, in the crews' languages. Fixed sentences with the times
// and minutes from the alert; nothing is written by a model, so the instruction cannot drift.
// Draft translations: native speakers must check them before a pilot (docs/eval/README.md).

import type { Language } from '@heatline/contracts';
import { formatClock } from '@heatline/contracts';
import type { WatchAlert } from './watch';

type Line = 'breakSoon' | 'rotateSoon' | 'breakNow' | 'restPlace' | 'over' | 'cap' | 'dust' | 'dustSevere';

const PLACE: Record<Language, { shade: string; cool: string }> = {
  en: { shade: 'in the shade', cool: 'in the cool room' },
  ar: { shade: 'في الظل', cool: 'في الغرفة المكيفة' },
  hi: { shade: 'छाँव में', cool: 'ठंडे कमरे में' },
  ur: { shade: 'سائے میں', cool: 'ٹھنڈے کمرے میں' },
  bn: { shade: 'ছায়ায়', cool: 'ঠান্ডা ঘরে' },
  ml: { shade: 'തണലിൽ', cool: 'തണുത്ത മുറിയിൽ' },
  tl: { shade: 'sa lilim', cool: 'sa malamig na silid' },
};

const TEXT: Record<Language, Record<Line, string>> = {
  en: {
    breakSoon: 'Crew {crew}: break at {time} for {min} minutes, {place}. Drink a cup of water.',
    rotateSoon: 'Crew {crew}: at {time}, move to your indoor task for {min} minutes. Drink a cup of water.',
    breakNow: 'Crew {crew}: stop now and rest {place}. Drink a cup of water.',
    restPlace: 'Crew {crew}: take your breaks in the cool room, not in the shade.',
    over: 'Crew {crew}: stop heat work now and go to the cool room. Tell someone if you feel dizzy or nauseous.',
    cap: 'New workers in crew {crew}: indoor work for the rest of the shift.',
    dust: 'Dust is high. Wear your mask outside.',
    dustSevere: 'Dust is very high. Heavy work moves inside. Wear your mask.',
  },
  ar: {
    breakSoon: 'الفريق {crew}: استراحة الساعة {time} لمدة {min} دقيقة {place}. اشربوا كوب ماء.',
    rotateSoon: 'الفريق {crew}: في الساعة {time}، انتقلوا إلى مهمتكم الداخلية لمدة {min} دقيقة. اشربوا كوب ماء.',
    breakNow: 'الفريق {crew}: توقفوا الآن واستريحوا {place}. اشربوا كوب ماء.',
    restPlace: 'الفريق {crew}: خذوا استراحاتكم في الغرفة المكيفة، وليس في الظل.',
    over: 'الفريق {crew}: أوقفوا العمل في الحر الآن واذهبوا إلى الغرفة المكيفة. أخبروا أحدًا إذا شعرتم بدوخة أو غثيان.',
    cap: 'العمال الجدد في الفريق {crew}: عمل داخلي لبقية الوردية.',
    dust: 'الغبار مرتفع. ارتدِ الكمامة في الخارج.',
    dustSevere: 'الغبار مرتفع جدًا. العمل الشاق ينتقل إلى الداخل. ارتدِ الكمامة.',
  },
  hi: {
    breakSoon: 'टीम {crew}: {time} बजे {min} मिनट का आराम, {place}। एक कप पानी पिएँ।',
    rotateSoon: 'टीम {crew}: {time} बजे {min} मिनट के लिए अंदर वाले काम पर जाएँ। एक कप पानी पिएँ।',
    breakNow: 'टीम {crew}: अभी रुकें और {place} आराम करें। एक कप पानी पिएँ।',
    restPlace: 'टीम {crew}: आराम ठंडे कमरे में करें, छाँव में नहीं।',
    over: 'टीम {crew}: गर्मी में काम अभी रोकें और ठंडे कमरे में जाएँ। चक्कर या मतली हो तो किसी को बताएँ।',
    cap: 'टीम {crew} के नए कामगार: बाकी शिफ़्ट में अंदर का काम।',
    dust: 'धूल ज़्यादा है। बाहर मास्क पहनें।',
    dustSevere: 'धूल बहुत ज़्यादा है। भारी काम अंदर होगा। मास्क पहनें।',
  },
  ur: {
    breakSoon: 'ٹیم {crew}: {time} بجے {min} منٹ کا آرام، {place}۔ ایک کپ پانی پئیں۔',
    rotateSoon: 'ٹیم {crew}: {time} بجے {min} منٹ کے لیے اندر والے کام پر جائیں۔ ایک کپ پانی پئیں۔',
    breakNow: 'ٹیم {crew}: ابھی رکیں اور {place} آرام کریں۔ ایک کپ پانی پئیں۔',
    restPlace: 'ٹیم {crew}: آرام ٹھنڈے کمرے میں کریں، سائے میں نہیں۔',
    over: 'ٹیم {crew}: گرمی میں کام ابھی روکیں اور ٹھنڈے کمرے میں جائیں۔ چکر یا متلی ہو تو کسی کو بتائیں۔',
    cap: 'ٹیم {crew} کے نئے کارکن: باقی شفٹ میں اندر کا کام۔',
    dust: 'گرد زیادہ ہے۔ باہر ماسک پہنیں۔',
    dustSevere: 'گرد بہت زیادہ ہے۔ بھاری کام اندر ہوگا۔ ماسک پہنیں۔',
  },
  bn: {
    breakSoon: 'দল {crew}: {time}-এ {min} মিনিটের বিরতি, {place}। এক কাপ পানি পান করুন।',
    rotateSoon: 'দল {crew}: {time}-এ {min} মিনিটের জন্য ভেতরের কাজে যান। এক কাপ পানি পান করুন।',
    breakNow: 'দল {crew}: এখনই থামুন এবং {place} বিশ্রাম নিন। এক কাপ পানি পান করুন।',
    restPlace: 'দল {crew}: বিরতি ঠান্ডা ঘরে নিন, ছায়ায় নয়।',
    over: 'দল {crew}: গরমের কাজ এখনই থামান এবং ঠান্ডা ঘরে যান। মাথা ঘুরলে বা বমি ভাব হলে কাউকে জানান।',
    cap: 'দল {crew}-এর নতুন কর্মীরা: বাকি শিফটে ভেতরের কাজ।',
    dust: 'ধুলো বেশি। বাইরে মাস্ক পরুন।',
    dustSevere: 'ধুলো খুব বেশি। ভারী কাজ ভেতরে হবে। মাস্ক পরুন।',
  },
  ml: {
    breakSoon: 'ടീം {crew}: {time}-ന് {min} മിനിറ്റ് വിശ്രമം, {place}. ഒരു കപ്പ് വെള്ളം കുടിക്കുക.',
    rotateSoon: 'ടീം {crew}: {time}-ന് {min} മിനിറ്റ് അകത്തെ ജോലിയിലേക്ക് മാറുക. ഒരു കപ്പ് വെള്ളം കുടിക്കുക.',
    breakNow: 'ടീം {crew}: ഇപ്പോൾ നിർത്തി {place} വിശ്രമിക്കുക. ഒരു കപ്പ് വെള്ളം കുടിക്കുക.',
    restPlace: 'ടീം {crew}: വിശ്രമസമയത്ത് തണുത്ത മുറിയിൽ വിശ്രമിക്കുക, തണലിൽ അല്ല.',
    over: 'ടീം {crew}: ചൂടിലെ ജോലി ഇപ്പോൾ നിർത്തി തണുത്ത മുറിയിലേക്ക് പോകുക. തലകറക്കമോ ഓക്കാനമോ തോന്നിയാൽ ആരോടെങ്കിലും പറയുക.',
    cap: 'ടീം {crew}-ലെ പുതിയ തൊഴിലാളികൾ: ഷിഫ്റ്റിന്റെ ബാക്കി സമയം അകത്തെ ജോലി.',
    dust: 'പൊടി കൂടുതലാണ്. പുറത്ത് മാസ്ക് ധരിക്കുക.',
    dustSevere: 'പൊടി വളരെ കൂടുതലാണ്. കഠിന ജോലി അകത്തേക്ക് മാറ്റുന്നു. മാസ്ക് ധരിക്കുക.',
  },
  tl: {
    breakSoon: 'Crew {crew}: magpahinga {place} nang {min} minuto simula {time}. Uminom ng isang tasa ng tubig.',
    rotateSoon: 'Crew {crew}: sa {time}, lumipat sa trabaho sa loob nang {min} minuto. Uminom ng isang tasa ng tubig.',
    breakNow: 'Crew {crew}: huminto ngayon at magpahinga {place}. Uminom ng isang tasa ng tubig.',
    restPlace: 'Crew {crew}: magpahinga sa malamig na silid, hindi sa lilim.',
    over: 'Crew {crew}: itigil ngayon ang trabaho sa init at pumunta sa malamig na silid. Sabihin sa isang tao kung nahihilo o nasusuka ka.',
    cap: 'Mga bagong manggagawa sa crew {crew}: trabaho sa loob para sa natitirang shift.',
    dust: 'Mataas ang alikabok. Magsuot ng mask sa labas.',
    dustSevere: 'Napakataas ng alikabok. Ililipat sa loob ang mabigat na trabaho. Magsuot ng mask.',
  },
};

export const BROADCAST_LANGUAGES: Language[] = ['en', 'ar', 'hi', 'ur', 'bn', 'ml', 'tl'];

/** Which fixed line an alert maps to, if any, with its values. */
export function broadcastFact(alert: WatchAlert, rest: 'shade' | 'cool-room' = 'cool-room'): { line: Line; values: Record<string, string>; place: 'shade' | 'cool' } | null {
  const place = rest === 'cool-room' ? 'cool' : 'shade';
  const crew = alert.crew ?? '';
  switch (alert.kind) {
    case 'break-soon':
    case 'break-moved':
      return alert.due !== undefined ? { line: alert.mode === 'rotate' ? 'rotateSoon' : 'breakSoon', values: { crew, time: formatClock(alert.due), min: String(alert.forMin ?? 10) }, place } : null;
    case 'break-now': return { line: 'breakNow', values: { crew }, place };
    case 'rest-place': return { line: 'restPlace', values: { crew }, place: 'cool' };
    case 'over-limit': return { line: 'over', values: { crew }, place: 'cool' };
    case 'cap': return { line: 'cap', values: { crew }, place };
    case 'dust': return /severe/i.test(alert.title) ? { line: 'dustSevere', values: {}, place } : /back to normal/i.test(alert.title) ? null : { line: 'dust', values: {}, place };
    default: return null;
  }
}

/** The broadcast for an alert in one language, or null for alerts meant only for the supervisor. */
export function broadcast(alert: WatchAlert, language: Language, rest: 'shade' | 'cool-room' = 'cool-room'): string | null {
  const fact = broadcastFact(alert, rest);
  if (!fact) return null;
  let text = TEXT[language][fact.line].replaceAll('{place}', PLACE[language][fact.place]);
  for (const [k, v] of Object.entries(fact.values)) text = text.replaceAll(`{${k}}`, v);
  return text;
}

/** Every broadcast line in English and one language, for translation checks. */
export function broadcastLines(language: Language): { key: string; english: string; text: string }[] {
  const sample: Record<string, string> = { crew: 'B', time: '10:40', min: '12' };
  return (Object.keys(TEXT.en) as Line[]).flatMap((line) => (['shade', 'cool'] as const).filter((p) => p === 'cool' || line === 'breakSoon' || line === 'breakNow').map((place) => {
    const fill = (l: Language) => {
      let t = TEXT[l][line].replaceAll('{place}', PLACE[l][place]);
      for (const [k, v] of Object.entries(sample)) t = t.replaceAll(`{${k}}`, v);
      return t;
    };
    return { key: `${line}:${place}`, english: fill('en'), text: fill(language) };
  }));
}
