import Polyglot from 'node-polyglot/build/polyglot'
import ZHCN from './zh-CN.json'
import ZHTW from './zh-TW.json'
import EN from './en.json'
import ES from './es-ES.json'
import FR from './fr.json'
import RU from './ru.json'
import DE from './de.json'
import PL from './pl.json'
import KO from './ko.json'

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
