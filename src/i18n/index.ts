import ZHCN from './zh-CN.json'
import ZHTW from './zh-TW.json'
import EN from './en.json'
import ES from './es-ES.json'
import FR from './fr.json'
import RU from './ru.json'
import DE from './de.json'
import PL from './pl.json'
import KO from './ko.json'
import FA from './fa.json'
import JA from './ja.json'

type Phrases = Record<string, string>

const i18nMap: Record<string, Phrases> = {
  zh: ZHCN,
  'zh-CN': ZHCN,
  'zh-TW': ZHTW,
  en: EN,
  'es-ES': ES,
  fr: FR,
  ru: RU,
  de: DE,
  pl: PL,
  ko: KO,
  fa: FA,
  ja: JA,
}

// node-polyglot 复数规则的最小子集，覆盖 gitalk 自带的 12 种语言
type PluralRule = (n: number) => number

const pluralRules: Record<string, PluralRule> = {
  chinese: () => 0,
  german: (n) => (n !== 1 ? 1 : 0),
  french: (n) => (n > 1 ? 1 : 0),
  russian: (n) => {
    const lastTwo = n % 100
    const end = lastTwo % 10
    if (lastTwo !== 11 && end === 1) return 0
    if (end >= 2 && end <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 1
    return 2
  },
  polish: (n) => {
    if (n === 1) return 0
    const end = n % 10
    if (end >= 2 && end <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 1
    return 2
  },
}

const languageToRule: Record<string, PluralRule> = {}
for (const [rule, languages] of Object.entries({
  chinese: ['fa', 'id', 'ja', 'ko', 'lo', 'ms', 'th', 'tr', 'zh'],
  german: ['da', 'de', 'en', 'es', 'fi', 'el', 'he', 'hu', 'it', 'nl', 'no', 'pt', 'sv'],
  french: ['fr', 'tl', 'pt-br'],
  russian: ['hr', 'ru'],
  polish: ['pl'],
})) {
  for (const lang of languages) languageToRule[lang] = pluralRules[rule]
}

const DELIMITER = '||||'

export type TranslateValues = Record<string, string | number>

export class I18n {
  private readonly phrases: Phrases
  private readonly pluralRule: PluralRule

  constructor(
    phrases: Phrases,
    public readonly locale: string
  ) {
    this.phrases = phrases
    const base = locale.toLowerCase()
    this.pluralRule =
      languageToRule[base] || languageToRule[base.split('-')[0]] || pluralRules.german
  }

  t(key: string, values: TranslateValues = {}): string {
    let phrase = this.phrases[key] ?? key

    if (phrase.includes(DELIMITER) && typeof values.smart_count === 'number') {
      const forms = phrase.split(DELIMITER)
      const index = Math.min(this.pluralRule(Math.abs(values.smart_count)), forms.length - 1)
      phrase = forms[index].trim()
    }

    return phrase.replace(/%\{(.*?)\}/g, (match, name: string) =>
      name in values ? String(values[name]) : match
    )
  }
}

export default function i18n(language: string): I18n {
  return new I18n(i18nMap[language] || i18nMap.en, language)
}
