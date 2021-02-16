import Polyglot from 'node-polyglot/build/polyglot'
import EN from './en.json'

const i18nMap = {
  'en': EN,
}

export default function (language) {
  return new Polyglot({
    phrases: i18nMap[language] || i18nMap.en,
    locale: language
  })
}
