import i18n from './index'
import EN from './en.json'
import ZHCN from './zh-CN.json'

describe('i18n', function () {
  it('falls back to english when language is unsupported', function () {
    const unsupported = i18n('unknown-lang')
    expect(unsupported.t('login-with-github')).toEqual(EN['login-with-github'])
  })

  it('uses zh-CN phrases for zh alias', function () {
    const zh = i18n('zh')
    expect(zh.t('login-with-github')).toEqual(ZHCN['login-with-github'])
  })

  it('uses requested language when available', function () {
    const ja = i18n('ja')
    expect(ja.t('logout')).not.toEqual(EN.logout)
  })
})
