import { describe, it, expect } from 'vitest'
import i18n from './index'
import EN from './en.json'
import ZHCN from './zh-CN.json'

describe('i18n', () => {
  it('falls back to english when language is unsupported', () => {
    const unsupported = i18n('unknown-lang')
    expect(unsupported.t('login-with-github')).toEqual(EN['login-with-github'])
  })

  it('uses zh-CN phrases for zh alias', () => {
    const zh = i18n('zh')
    expect(zh.t('login-with-github')).toEqual(ZHCN['login-with-github'])
  })

  it('uses requested language when available', () => {
    const ja = i18n('ja')
    expect(ja.t('logout')).not.toEqual(EN.logout)
  })

  it('returns key when phrase missing', () => {
    expect(i18n('en').t('not-a-key')).toEqual('not-a-key')
  })

  it('interpolates %{var} placeholders', () => {
    const en = i18n('en')
    expect(en.t('please-contact', { user: '@foo' })).toContain('@foo')
  })

  describe('pluralization (smart_count)', () => {
    it('selects singular/plural forms in english', () => {
      const en = i18n('en')
      expect(en.t('counts', { counts: 1, smart_count: 1 })).toEqual('1 comment')
      expect(en.t('counts', { counts: 2, smart_count: 2 })).toEqual('2 comments')
      expect(en.t('counts', { counts: 0, smart_count: 0 })).toEqual('0 comments')
    })

    it('uses single form for chinese', () => {
      const zh = i18n('zh-CN')
      expect(zh.t('counts', { counts: 5, smart_count: 5 })).toEqual('5 条评论')
    })

    it('applies polish three-form rule', () => {
      const pl = i18n('pl')
      expect(pl.t('counts', { counts: 1, smart_count: 1 })).toEqual('1 komentarz')
      expect(pl.t('counts', { counts: 2, smart_count: 2 })).toEqual('2 komentarze')
      expect(pl.t('counts', { counts: 5, smart_count: 5 })).toEqual('5 komentarzy')
    })

    it('clamps to last form when locale rule exceeds provided forms', () => {
      // ru.json 只提供两种形式，规则返回 2 时应回落到最后一种
      const ru = i18n('ru')
      expect(ru.t('counts', { counts: 5, smart_count: 5 })).toEqual('5 комментариев')
    })
  })
})
