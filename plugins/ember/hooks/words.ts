// ember's own words: the band, the board, toasts and command answers. English
// by default; the `language` option switches them to Russian.

export type Language = 'en' | 'ru'

function ruPlural(n: number, one: string, few: string, many: string): string {
  const tens = Math.abs(n) % 100
  const last = tens % 10
  if (tens > 10 && tens < 20) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

function enPlural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

export type Words = {
  // Spans and counts.
  min: string
  hour: string
  minutesToCold: (m: number) => string
  pings: (n: number) => string
  // States.
  notCreated: string
  cold: string
  coldShort: string
  // The band.
  inCache: (tokens: string) => string
  warm: string
  keptUntil: (clock: string) => string
  noPingsYet: string
  coolsAt: (clock: string) => string
  chatCost: (usd: string) => string
  coolsIn: (m: number) => string
  coldRestart: (cold: string, ping: string) => string
  cacheCold: string
  ago: (span: string) => string
  nextRewrites: (tokens: string, usd: string) => string
  cacheNotCreated: string
  release: string
  keepWarm: string
  handoff: string
  handoffQueued: string
  writingHandoff: string
  keepChat: string
  clearAndContinue: string
  handoffReady: string
  clearing: string
  // Toasts.
  autoKept: (k: number) => string
  released: (hours: number, pings: string, usd: string) => string
  coldBeforePing: string
  pingFailed: string
  pingRewrote: string
  noSkill: (skill: string) => string
  handoffNotStarted: string
  stillAnswering: string
  clearFailed: string
  clearedFilled: string
  clearedNotSent: string
  remoteKeep: (name: string, isKept: boolean) => string
  handoffMissing: string
  continuePrefix: string
  // The board.
  chat: string
  chats: string
  coldWord: string
  boardHead: (open: number, usd: string) => string
  keeping: string
  releaseLower: string
  keepLower: string
  keep: string
  // /ember's status.
  toCold: (mmss: string, kept: boolean) => string
  ttl: (min: number, source: 'setting' | 'measured' | 'default') => string
  autoKeepFrom: (k: number) => string
  noAutoKeep: string
  tokensLine: (k: number, ttl: string, auto: string) => string
  coldRestarts: (n: number, usd: string, cost: string) => string
  usage: string
}

const WORDS: Record<Language, Words> = {
  en: {
    min: 'min',
    hour: 'h',
    minutesToCold: m => `${m} ${enPlural(m, 'minute', 'minutes')} until cold`,
    pings: n => `${n} ${enPlural(n, 'ping', 'pings')}`,
    notCreated: 'no cache yet',
    cold: 'cache is cold',
    coldShort: 'cold',
    inCache: t => `${t} tokens in cache`,
    warm: 'Warm',
    keptUntil: c => ` · keeping until ${c}`,
    noPingsYet: 'no pings yet',
    coolsAt: c => ` · goes cold at ${c}`,
    chatCost: u => `chat ${u}`,
    coolsIn: m => `Cold in ${m} min`,
    coldRestart: (cold, ping) => `cold restart ≈ ${cold} · ping ≈ ${ping}`,
    cacheCold: 'Cache is cold',
    ago: s => ` · ${s} ago`,
    nextRewrites: (t, u) => `the next message rewrites ${t} tokens ≈ ${u}`,
    cacheNotCreated: 'No cache yet',
    release: 'Release',
    keepWarm: 'Keep warm',
    handoff: 'Handoff',
    handoffQueued: 'handoff queued',
    writingHandoff: 'writing handoff…',
    keepChat: 'Keep chat',
    clearAndContinue: 'Clear and continue',
    handoffReady: 'handoff ready · the new chat starts from it',
    clearing: 'clearing the chat…',
    autoKept: k => `ember is keeping the cache warm: the chat has over ${k}k tokens`,
    released: (h, p, u) => `ember released the cache: ${h} h passed · ${p}, ${u}`,
    coldBeforePing: 'The cache went cold before the ping',
    pingFailed: 'The ping failed, cache released',
    pingRewrote: 'The ping rewrote the cache, no point keeping it',
    noSkill: s => `! No /${s} skill`,
    handoffNotStarted: '! Handoff did not start',
    stillAnswering: 'Claude is still answering: continuing when it is done',
    clearFailed: '! /clear failed, the handoff is kept',
    clearedFilled: 'Chat cleared, the handoff is in the prompt box: press Enter',
    clearedNotSent: '! Chat cleared, but the handoff was not sent',
    remoteKeep: (name, isKept) => `“${name}”: ${isKept ? 'releases' : 'keeps'} the cache within 15 seconds`,
    handoffMissing: '! No handoff: the turn ended without one',
    continuePrefix: 'Continuing from the previous chat’s handoff:\n\n',
    chat: 'chat',
    chats: 'Chats',
    coldWord: 'cold',
    boardHead: (n, u) => `${n} open · ${u} today`,
    keeping: ' · keeping',
    releaseLower: 'release',
    keepLower: 'keep',
    keep: 'Keep',
    toCold: (t, kept) => `cold in ${t}${kept ? ', keeping' : ''}`,
    ttl: (m, s) => `TTL ${m} min (${s === 'setting' ? 'setting' : s === 'measured' ? 'measured' : 'default'})`,
    autoKeepFrom: k => `keeps chats from ${k}k tokens by itself`,
    noAutoKeep: 'keeps none by itself',
    tokensLine: (k, ttl, auto) => `${k}k tokens · ${ttl} · ${auto}`,
    coldRestarts: (n, u, c) => `cold restarts: ${n}, ${u} · chat cost ${c}`,
    usage: '/ember keep [hours] · /ember release · /ember name <name> · /board · /ember:handoff',
  },
  ru: {
    min: 'мин',
    hour: 'ч',
    minutesToCold: m => `${m} ${ruPlural(m, 'минута', 'минуты', 'минут')} до остывания`,
    pings: n => `${n} ${ruPlural(n, 'пинг', 'пинга', 'пингов')}`,
    notCreated: 'кэш ещё не создан',
    cold: 'кэш остыл',
    coldShort: 'остыл',
    inCache: t => `${t} токенов в кэше`,
    warm: 'Тёплый',
    keptUntil: c => ` · держу до ${c}`,
    noPingsYet: 'пингов пока не было',
    coolsAt: c => ` · остынет в ${c}`,
    chatCost: u => `чат ${u}`,
    coolsIn: m => `Остынет через ${m} мин`,
    coldRestart: (cold, ping) => `холодный рестарт ≈ ${cold} · пинг ≈ ${ping}`,
    cacheCold: 'Кэш остыл',
    ago: s => ` · ${s} назад`,
    nextRewrites: (t, u) => `следующее сообщение перепишет ${t} токенов ≈ ${u}`,
    cacheNotCreated: 'Кэш ещё не создан',
    release: 'Отпустить',
    keepWarm: 'Держать тёплым',
    handoff: 'Handoff',
    handoffQueued: 'handoff в очереди',
    writingHandoff: 'пишу handoff…',
    keepChat: 'Оставить чат',
    clearAndContinue: 'Очистить и продолжить',
    handoffReady: 'handoff готов · новый чат начнётся с него',
    clearing: 'очищаю чат…',
    autoKept: k => `ember держит кэш тёплым: в чате больше ${k}k токенов`,
    released: (h, p, u) => `ember отпустил кэш: прошло ${h} ч · ${p}, ${u}`,
    coldBeforePing: 'Кэш остыл раньше пинга',
    pingFailed: 'Пинг не прошёл, кэш отпущен',
    pingRewrote: 'Пинг записал кэш заново, держать нет смысла',
    noSkill: s => `! Нет навыка /${s}`,
    handoffNotStarted: '! Handoff не запустился',
    stillAnswering: 'Claude ещё отвечает: продолжим, когда закончит',
    clearFailed: '! /clear не прошёл, handoff остался',
    clearedFilled: 'Чат очищен, handoff в поле ввода: нажмите Enter',
    clearedNotSent: '! Чат очищен, но handoff не отправился',
    remoteKeep: (name, isKept) => `«${name}»: ${isKept ? 'отпустит' : 'будет держать'} кэш в течение 15 секунд`,
    handoffMissing: '! Handoff не получился: ход закончился без него',
    continuePrefix: 'Продолжаем с handoff из прошлого чата:\n\n',
    chat: 'чат',
    chats: 'Чаты',
    coldWord: 'холодный',
    boardHead: (n, u) => `${n} открыто · ${u} сегодня`,
    keeping: ' · держу',
    releaseLower: 'отпустить',
    keepLower: 'держать',
    keep: 'Держать',
    toCold: (t, kept) => `до остывания ${t}${kept ? ', держу' : ''}`,
    ttl: (m, s) => `TTL ${m} мин (${s === 'setting' ? 'настройка' : s === 'measured' ? 'измерен' : 'по умолчанию'})`,
    autoKeepFrom: k => `сам держу чаты от ${k}k токенов`,
    noAutoKeep: 'сам не держу',
    tokensLine: (k, ttl, auto) => `${k}k токенов · ${ttl} · ${auto}`,
    coldRestarts: (n, u, c) => `холодных рестартов: ${n}, ${u} · чат стоил ${c}`,
    usage: '/ember keep [часы] · /ember release · /ember name <имя> · /board · /ember:handoff',
  },
}

let current: Words = WORDS.en

/** The words in use; English unless the `language` option is `ru`. */
export function words(): Words {
  return current
}

export function setLanguage(language: unknown): void {
  current = language === 'ru' ? WORDS.ru : WORDS.en
}
