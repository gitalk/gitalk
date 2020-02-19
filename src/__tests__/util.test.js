import { queryParse, queryStringify, formatErrorMsg } from '../util'

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
