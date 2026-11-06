// What people say on site: authored lines for each scenario plus lines generated from engine
// events (a battery dies, the network drops, a tent goes up, someone is told to rest). Shown as
// speech bubbles in the worker's own language with an English line underneath.
// Translations are drafts written for the prototype; review with native speakers before a pilot.

import type { Language, Minute, RunResult, Scenario } from '@heatline/contracts';

export interface Line {
  id: string;
  minute: Minute;
  speaker: string;
  language: Language;
  native: string;
  english: string;
}

type Say = [native: string, english: string];

const REST: Partial<Record<Language, Say>> = {
  ml: ['ശരി, ഞാൻ ക്യാബിനിലേക്ക് പോകുന്നു.', 'Okay, I’m going to the cabin.'],
  bn: ['ঠিক আছে, আমি বিশ্রাম নিচ্ছি।', 'Okay, I’m taking a rest.'],
  hi: ['ठीक है, मैं केबिन जा रहा हूँ।', 'Okay, I’m going to the cabin.'],
  ur: ['ٹھیک ہے، میں کیبن جا رہا ہوں۔', 'Okay, I’m going to the cabin.'],
  tl: ['Sige, magpapahinga muna ako.', 'Okay, I’ll rest for a bit.'],
  ar: ['تمام، رايح أرتاح شوي.', 'Fine, I’m going to rest a bit.'],
};

const BATTERY: Partial<Record<Language, Say>> = {
  hi: ['मेरी घड़ी की बैटरी खत्म हो गई।', 'My watch battery has run out.'],
  ml: ['എന്റെ വാച്ച് ഓഫായി.', 'My watch has switched off.'],
  ur: ['میری گھڑی بند ہو گئی۔', 'My watch has stopped.'],
};

const AHMED = {
  afternoon: ['يلا يا شباب، خلصت استراحة الظهر. اشربوا مي قبل ما تطلعوا.', 'Come on, lads, the midday break is over. Drink water before you go up.'] as Say,
  morning: ['صباح الخير يا شباب. اشربوا مي كثير اليوم.', 'Morning, lads. Drink plenty of water today.'] as Say,
  heavy: ['الجو ثقيل اليوم. انتبهوا لبعض.', 'The air is heavy today. Look out for each other.'] as Say,
  truck: ['الخلاطة وصلت البوابة.', 'The mixer is at the gate.'] as Say,
  tent: ['الخيمة جاهزة.', 'The tent is up.'] as Say,
  pourStart: ['يلا، ابدأوا الصب.', 'Right, start the pour.'] as Say,
  pourDone: ['خلصنا الصب. أحسنتم.', 'The pour is done. Well done.'] as Say,
  network: ['النت فاصل. التلفونات لسه شغالة، انتبهوا للتحذيرات.', 'The network is down. The phones still work, so mind the warnings.'] as Say,
  dust: ['غبار جاي! غطوا وجوهكم.', 'Dust coming! Cover your faces.'] as Say,
  firstAid: ['جيبوا الإسعاف! حطوه في الظل.', 'Get first aid! Get him into the shade.'] as Say,
  rotation: ['المجموعة الثانية على الكابينة، والثالثة فوق.', 'Group two to the cabin, group three up on the deck.'] as Say,
  sendBack: ['رجّعوا الخلاطة. ما في صب اليوم.', 'Send the mixer back. No pour today.'] as Say,
  break: ['ربع ساعة ونوقف للاستراحة.', 'Fifteen minutes and we stop for the break.'] as Say,
  bus: ['يلا على الباص.', 'Everyone to the bus.'] as Say,
};

export function dialogueFor(scenario: Scenario, run: RunResult, branch: 'original' | 'plan'): Line[] {
  const lines: Line[] = [];
  const lang = (id: string) => scenario.workers.find((w) => w.id === id)?.language ?? 'en';
  const add = (minute: Minute | null | undefined, speaker: string, [native, english]: Say) => {
    if (minute === null || minute === undefined) return;
    lines.push({ id: `${speaker}-${minute}-${lines.length}`, minute, speaker, language: lang(speaker), native, english });
  };
  const at = (kind: string, worker?: string) => run.events.find((e) => e.kind === kind && (!worker || e.worker === worker))?.minute ?? null;

  // Authored openings for each scenario.
  switch (scenario.id) {
    case 'afternoon-pour':
      add(scenario.start, 'ahmed', AHMED.afternoon);
      add(scenario.start + 1, 'suresh', ['നമുക്ക് ഇന്ന് ഈ സ്ലാബ് തീർക്കണം.', 'We have to finish this slab today.']);
      add(scenario.start + 1, 'anwar', ['আমি কি টুল স্টোরে যাব?', 'Should I go to the tool store?']);
      break;
    case 'racing-the-break':
      add(scenario.start, 'ahmed', AHMED.morning);
      add(scenario.start + 1, 'bilal', ['اس سوٹ میں بہت گرمی ہے۔', 'It’s very hot in this suit.']);
      add(scenario.start + 2, 'joel', ['Kakabalik ko lang, ang init pala dito.', 'I’ve only just come back, and it’s so hot here.']);
      add(745, 'ahmed', AHMED.break);
      break;
    case 'no-pour-day':
      add(scenario.start, 'ahmed', AHMED.heavy);
      add(scenario.start + 1, 'suresh', ['ഇന്ന് ശ്വാസം മുട്ടുന്ന ചൂടാണ്.', 'It’s suffocatingly hot today.']);
      if (branch === 'plan' && run.pourStartedAt === null) add(scenario.pour.truckArrives + 1, 'ahmed', AHMED.sendBack);
      break;
    case 'everything-fails':
      add(scenario.start, 'ahmed', AHMED.afternoon);
      add(scenario.start + 1, 'ravi', ['बैटरी छह प्रतिशत है, देखते हैं कितनी चलती है।', 'Battery’s at six percent; let’s see how long it lasts.']);
      break;
  }

  // Lines that follow engine events.
  add(at('truck-arrived'), 'ahmed', AHMED.truck);
  for (const e of run.events.filter((x) => x.kind === 'tent-ready')) add(e.minute, 'ahmed', AHMED.tent);
  add(at('pour-started'), 'ahmed', AHMED.pourStart);
  add(at('pour-finished'), 'ahmed', AHMED.pourDone);
  if (branch === 'plan' && run.pourStartedAt !== null) add(run.pourStartedAt + 6, 'ahmed', AHMED.rotation);
  add(at('network-down'), 'ahmed', AHMED.network);
  add(at('weather-modifier'), 'ahmed', AHMED.dust);
  for (const e of run.events.filter((x) => x.kind === 'battery-died' && x.worker)) {
    const say = BATTERY[lang(e.worker!)];
    if (say) add(e.minute, e.worker!, say);
  }
  for (const e of run.events.filter((x) => x.kind === 'red-flag' && x.worker)) {
    const victim = scenario.workers.find((w) => w.id === e.worker)!;
    if (victim.id === 'suresh') add(e.minute - 12, 'suresh', ['അഞ്ചു മിനിറ്റ് കൂടി, ഈ ഭാഗം തീർക്കാം.', 'Five more minutes; let’s finish this section.']);
    const mate = scenario.workers.find((w) => w.crew === victim.crew && w.id !== victim.id && w.language === victim.language) ?? scenario.workers.find((w) => w.crew === victim.crew && w.id !== victim.id)!;
    add(e.minute, mate.id, mate.language === 'ml' ? ['സുരേഷ്! സുരേഷ്, ഇരിക്കൂ!', `${victim.name}! ${victim.name}, sit down!`] : [`${victim.name}!`, `${victim.name}! Sit down!`]);
    add(e.minute + 1, 'ahmed', AHMED.firstAid);
  }

  // Featured workers acknowledge their guardian when it tells them to rest (once per stretch).
  const featured = scenario.workers.filter((w) => w.featured && w.id !== 'ahmed');
  for (const w of featured) {
    let last = -60;
    for (const rec of run.minutes) {
      const warning = rec.warnings.find((x) => x.worker === w.id)!;
      if (warning.action === 'rest-cabin' && rec.minute - last > 40) {
        const say = REST[w.language];
        if (say) add(rec.minute + 1, w.id, say);
        last = rec.minute;
      }
    }
  }

  add(scenario.end - 6, 'ahmed', AHMED.bus);
  add(scenario.end - 5, 'joel', ['Tara na, uwi na tayo.', 'Come on, let’s go home.']);
  return lines.sort((a, b) => a.minute - b.minute);
}
