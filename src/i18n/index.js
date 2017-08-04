import Polyglot from 'node-polyglot/build/polyglot'
import ZHCN from './zh-CN.json'
import ZHTW from './zh-TW.json'
import EN from './en.json'
import ES from './es-ES.json'

const i18nMap = {
  'zh': ZHCN,
  'zh-CN': ZHCN,
  'zh-TW': ZHTW,
  'en': EN,
  'es-ES': ES
}

export default function (language) {
  return new Polyglot({
    phrases: i18nMap[language] || i18nMap.en,
    locale: language
  })
}
