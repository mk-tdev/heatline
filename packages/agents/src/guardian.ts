// Guardian: speaks to one worker, in their language, about their own state. The warning level
// and the action come from the rules engine; the model only words them and must keep them.

import { z } from 'zod';
import type { Language, WarningAction } from '@heatline/contracts';
import type { GuardianContext } from './projections';

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  ar: 'Arabic',
  hi: 'Hindi',
  ur: 'Urdu',
  bn: 'Bengali',
  ml: 'Malayalam',
  tl: 'Tagalog',
};

export const GuardianMessage = z.object({
  message: z.string().describe("The message to the worker, in the worker's language, at most two short sentences."),
  english: z.string().describe('The same message in English, for the audit log and for reviewers.'),
});
export type GuardianMessage = z.infer<typeof GuardianMessage>;

export const GUARDIAN_SYSTEM = `You are the heat-safety guardian on one construction worker's phone at a site in Abu Dhabi.
You speak only to this worker, about this worker. The site's rules engine has already decided the warning level and the action; your job is to tell the worker, kindly and clearly, what to do now.

Rules:
- Write in the worker's language (given), plus an English version.
- At most two short sentences. Use the worker's first name. Plain words a tired person can follow.
- Always state the action given. Never weaken it, never add a different action, never say it is optional.
- For "emergency": use the fixed emergency template. Never advise oral fluids for a confused or unconscious person.
- This is a synthetic training scenario. Do not describe estimated body temperature or water deficit as measurements. Do not quote those values to the worker.
- No diagnosis, no medicine, no blame. Do not mention their supervisor or employer.
- Mention a number only if it appears in the context (minutes, litres).`;

export function guardianPrompt(ctx: GuardianContext): string {
  return [
    `Worker: ${ctx.name}, language: ${LANGUAGE_NAMES[ctx.language]}, ${ctx.acclimatised ? 'used to the heat' : `day ${ctx.daysOnSite} on site, not yet used to the heat`}.`,
    `Time ${ctx.clock}. Place: ${ctx.placeLabel}${ctx.indoors ? ' (indoors, air-conditioned; if the action is continue, they are on indoor duties, out of the heat)' : ''}, WBGT ${ctx.wbgt} °C.${ctx.ppe ? ` Wearing a ${ctx.ppe}, which traps heat (counts as +${ctx.clothingAdjustC} °C).` : ''}`,
    `Warning level: ${ctx.level}. Reasons: ${ctx.reasons.join(', ') || 'none'}. Action to give: ${ctx.action}.`,
    `Synthetic training estimates, not measurements (${ctx.source === 'wearable' ? 'from their wearable' : 'estimated, no wearable'}): body temperature about ${ctx.estCoreC} °C${ctx.heartRate ? `, heart rate ${ctx.heartRate}` : ''}, water deficit about ${ctx.waterDeficitL} L, ${ctx.minutesWorkedWithoutRest} minutes worked without a rest.`,
  ].join('\n');
}

/** Pre-written messages used whenever the model is unavailable, slow or rejected. Draft translations: review before a pilot. */
const TEMPLATES: Record<WarningAction, Record<Language, string>> = {
  continue: {
    en: '{name}, you are doing fine. Keep drinking water.',
    ar: '{name}، أنت بخير. استمر في شرب الماء.',
    hi: '{name}, आप ठीक हैं। पानी पीते रहें।',
    ur: '{name}، آپ ٹھیک ہیں۔ پانی پیتے رہیں۔',
    bn: '{name}, আপনি ভালো আছেন। পানি পান করতে থাকুন।',
    ml: '{name}, നിങ്ങൾ സുഖമായിരിക്കുന്നു. വെള്ളം കുടിക്കുന്നത് തുടരുക.',
    tl: '{name}, ayos ka. Patuloy na uminom ng tubig.',
  },
  drink: {
    en: '{name}, drink a full cup of water now.',
    ar: '{name}، اشرب كوبًا كاملًا من الماء الآن.',
    hi: '{name}, अभी एक पूरा कप पानी पिएँ।',
    ur: '{name}، ابھی ایک پورا کپ پانی پئیں۔',
    bn: '{name}, এখনই এক কাপ পানি পান করুন।',
    ml: '{name}, ഇപ്പോൾ ഒരു കപ്പ് വെള്ളം മുഴുവൻ കുടിക്കുക.',
    tl: '{name}, uminom ng isang buong tasa ng tubig ngayon.',
  },
  'rest-shade': {
    en: '{name}, take a short rest in the shade now and drink water.',
    ar: '{name}، خذ استراحة قصيرة في الظل الآن واشرب الماء.',
    hi: '{name}, अभी छाँव में थोड़ा आराम करें और पानी पिएँ।',
    ur: '{name}، ابھی سائے میں تھوڑا آرام کریں اور پانی پئیں۔',
    bn: '{name}, এখনই ছায়ায় একটু বিশ্রাম নিন এবং পানি পান করুন।',
    ml: '{name}, ഇപ്പോൾ തണലിൽ അൽപ്പം വിശ്രമിച്ച് വെള്ളം കുടിക്കുക.',
    tl: '{name}, magpahinga sandali sa lilim ngayon at uminom ng tubig.',
  },
  'rest-cabin': {
    en: '{name}, stop and rest in the cool cabin now. Drink a bottle of water.',
    ar: '{name}، توقف واسترح في الغرفة المكيفة الآن. اشرب زجاجة ماء.',
    hi: '{name}, अभी रुकें और ठंडे केबिन में आराम करें। एक बोतल पानी पिएँ।',
    ur: '{name}، ابھی رکیں اور ٹھنڈے کیبن میں آرام کریں۔ ایک بوتل پانی پئیں۔',
    bn: '{name}, এখনই থামুন এবং ঠান্ডা কেবিনে বিশ্রাম নিন। এক বোতল পানি পান করুন।',
    ml: '{name}, ഇപ്പോൾ നിർത്തി തണുത്ത ക്യാബിനിൽ വിശ്രമിക്കുക. ഒരു കുപ്പി വെള്ളം കുടിക്കുക.',
    tl: '{name}, huminto at magpahinga sa malamig na cabin ngayon. Uminom ng isang bote ng tubig.',
  },
  'stop-work': {
    en: '{name}, no more heat work today. Go to the tool store for indoor work.',
    ar: '{name}، لا مزيد من العمل في الحر اليوم. اذهب إلى مخزن الأدوات للعمل في الداخل.',
    hi: '{name}, आज गर्मी में और काम नहीं। अंदर के काम के लिए टूल स्टोर जाएँ।',
    ur: '{name}، آج گرمی میں مزید کام نہیں۔ اندر کے کام کے لیے ٹول اسٹور جائیں۔',
    bn: '{name}, আজ আর গরমের মধ্যে কাজ নয়। ভেতরের কাজের জন্য টুল স্টোরে যান।',
    ml: '{name}, ഇന്ന് ഇനി ചൂടിൽ ജോലി വേണ്ട. അകത്തെ ജോലിക്കായി ടൂൾ സ്റ്റോറിലേക്ക് പോകുക.',
    tl: '{name}, wala nang trabaho sa init ngayong araw. Pumunta sa tool store para sa trabaho sa loob.',
  },
  emergency: {
    en: '{name}, stop now and sit down. Help is coming. Call for first aid now.',
    ar: '{name}، توقف الآن واجلس. المساعدة في الطريق. اطلب الإسعافات الأولية الآن.',
    hi: '{name}, अभी रुकें और बैठ जाएँ। मदद आ रही है। अभी प्राथमिक सहायता बुलाएँ।',
    ur: '{name}، ابھی رکیں اور بیٹھ جائیں۔ مدد آ رہی ہے۔ ابھی ابتدائی طبی امداد بلائیں۔',
    bn: '{name}, এখনই থামুন এবং বসে পড়ুন। সাহায্য আসছে। এখনই প্রাথমিক চিকিৎসার সাহায্য ডাকুন।',
    ml: '{name}, ഇപ്പോൾ നിർത്തി ഇരിക്കുക. സഹായം വരുന്നു. ഉടൻ പ്രഥമശുശ്രൂഷയ്ക്കായി വിളിക്കുക.',
    tl: '{name}, huminto ngayon at umupo. Paparating na ang tulong. Tumawag ng first aid ngayon.',
  },
};

export function fallbackGuardianMessage(ctx: Pick<GuardianContext, 'name' | 'language' | 'action'>): GuardianMessage {
  const fill = (t: string) => t.replaceAll('{name}', ctx.name);
  return { message: fill(TEMPLATES[ctx.action][ctx.language]), english: fill(TEMPLATES[ctx.action].en) };
}

const SCRIPT: Partial<Record<Language, RegExp>> = {
  ar: /[؀-ۿ]/,
  ur: /[؀-ۿ]/,
  hi: /[ऀ-ॿ]/,
  bn: /[ঀ-৿]/,
  ml: /[ഀ-ൿ]/,
};

/** Reject model output that is the wrong script, too long, or drops the worker's name. Returns a reason or null. */
export function checkGuardianMessage(ctx: GuardianContext, out: GuardianMessage): string | null {
  if (!out.message.trim() || !out.english.trim()) return 'empty';
  if (out.message.length > 260 || out.english.length > 220) return 'too long';
  const script = SCRIPT[ctx.language];
  if (script && !script.test(out.message)) return 'wrong script';
  if (!out.english.includes(ctx.name)) return 'name missing';
  if (/\b(diagnos|medicine|tablet|pill|paracetamol|ibuprofen|supervisor|manager|fired)\b/i.test(out.english)) return 'forbidden content';
  return null;
}
