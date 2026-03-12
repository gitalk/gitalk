import {
  queryParse,
  queryStringify,
  formatErrorMsg,
  getMetaContent,
  hasClassInParent
} from '../util'

describe('util', function () {
  const search = 'a=b&c=1'
  const searchObject = {
    a: 'b',
    c: '1'
  }

  describe('queryParse', function () {
    it(search, function () {
      expect(queryParse(search)).toEqual(searchObject)
    })
    it(`?${search}`, function () {
      expect(queryParse(`?${search}`)).toEqual(searchObject)
    })
  })

  describe('queryStringify', function () {
    it('object', function () {
      expect(queryStringify(searchObject)).toEqual(search)
    })
    it('empty value', function () {
      expect(queryStringify({ a: '' })).toEqual('a=')
    })
    it('encode value', function () {
      expect(queryStringify({ a: 'hello world' })).toEqual('a=hello%20world')
    })
  })

  describe('getMetaContent', function () {
    it('meta content', function () {
      const querySelector = window.document.querySelector
      window.document.querySelector = jest.fn(function () {
        return {
          getAttribute: function () {
            return 'desc-content'
          }
        }
      })

      expect(getMetaContent('description')).toEqual('desc-content')

      window.document.querySelector = querySelector
    })

    it('custom content attr', function () {
      const querySelector = window.document.querySelector
      window.document.querySelector = jest.fn(function () {
        return {
          getAttribute: function () {
            return 'og-content'
          }
        }
      })

      expect(getMetaContent('description', 'og:description')).toEqual('og-content')

      window.document.querySelector = querySelector
    })
  })

  describe('hasClassInParent', function () {
    it('find class from parent nodes', function () {
      const parent = { className: 'parent-class', parentNode: null }
      const child = { className: 'child-class', parentNode: parent }

      expect(hasClassInParent(child, 'parent-class')).toBe(true)
    })

    it('return false when no class found in chain', function () {
      const parent = { className: 'parent-class', parentNode: null }
      const child = { className: 'child-class', parentNode: parent }

      expect(hasClassInParent(child, 'not-exist')).toBe(false)
    })
  })

  describe('formatErrorMsg', function () {
    it('err.response', function () {
      expect(formatErrorMsg({
        response: {
          data: {
            message: 'm1',
            errors: [{
              message: 'm21'
            }, {
              message: 'm22'
            }]
          }
        }
      })).toEqual('Error: m1. m21, m22')
    })
    it('err.msg', function () {
      expect(formatErrorMsg({
        message: 'm1'
      })).toEqual('Error: m1')
    })
  })
})
