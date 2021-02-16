import Polyglot from 'node-polyglot/build/polyglot'
import EN from './en.json'

const i18nMap = {
  'zh': ZHCN,
  'zh-CN': ZHCN,
  'zh-TW': ZHTW,
  'en': EN,
  'es-ES': ES,
  'fr': FR,
  'ru': RU,
  'de': DE,
  'pl': PL,
  'ko': KO,
}

export default function (language) {
  return new Polyglot({
    phrases: i18nMap[language] || i18nMap.en,
    locale: language
  })
}
