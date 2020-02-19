import moxios from 'moxios'

// mock window.*
global.localStorage = {
  getItem () { return '{}' },
  setItem () {},
  removeItem () {}
}
global.document = {
  title: ''
}
global.location = {
  search: '',
  href: ''
}

// mock axios request
moxios.stubRequest(/\/repos\/.*\/comments/, {
  status: 200,
  response: [{
    id: 1,
    html_url: 'https://github.com/xxx/xxx/issues/1#issuecomment-xxx',
    body_html: '<p>111</p>',
    created_at: '2017-06-30T09:00:19Z',
    user: {
      login: 'booxood',
      avatar_url: 'https://avatars0.githubusercontent.com/u/2151410?v=3',
      html_url: 'https://github.com/booxood'
    }
  }, {
    id: 2,
    html_url: 'https://github.com/xxx/xxx/issues/1#issuecomment-xxx',
    body_html: '<p>222</p>',
    created_at: '2017-06-30T09:01:19Z',
    user: {
      login: 'booxood',
      avatar_url: 'https://avatars0.githubusercontent.com/u/2151410?v=3',
      html_url: 'https://github.com/booxood'
    }
  }]
})
moxios.stubRequest(/\/repos\/.*\/issues/, {
  status: 200,
  response: [{
    html_url: 'https://github.com/xxx/xxx/issues/1',
    comments_url: 'https://api.github.com/repos/xxx/xxx/issues/1/comments',
    comments: 2
  }]
})
moxios.stubRequest(/\/graphql/, {
  status: 200,
  response: {
    data: {
      repository: {
        issue: {
          comments: {
            nodes: [{
              databaseId: 1,
              author: {},
              bodyHTML: '<p>111</p>',
              body: '111',
              createdAt: '2017-06-30T09:00:19Z',
            }, {
              databaseId: 2,
              author: {},
              bodyHTML: '<p>222</p>',
              body: '222',
              createdAt: '2017-06-30T09:01:19ZZ',
            }],
            pageInfo: {},
            totalCount: 2
          },
        }
      }
    }
  }
})
moxios.stubRequest(/.*/, {
  status: 404,
})
