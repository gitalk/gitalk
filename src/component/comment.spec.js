import React from 'react'
import { shallow, mount } from 'enzyme'

import Comment from './comment'
import Avatar from './avatar'

const comment = {
  html_url: 'https://github.com/xxxx/xxxxx/issues/1#issuecomment-xxxxx',
  body_html: '<p>123</p>',
  created_at: '2017-06-30T09:01:19Z',
  user: {
    login: 'booxood',
    avatar_url: 'https://avatars0.githubusercontent.com/u/2151410?v=3',
    html_url: 'https://github.com/booxood'
  }
}

const emailComment = {
  html_url: 'https://github.com/xxxx/xxxxx/issues/1#issuecomment-xxxxx',
  body_html: '<div class="email-fragment">email response</div>↵<span class="email-hidden-toggle"><a href="#">…</a></span><div class="email-hidden-reply">↵<div class="email-signature-reply">------------------&amp;nbsp;原始邮件&amp;nbsp;------------------↵发件人:&amp;nbsp;↵↵↵↵↵xxxxxxxxxxxxxx↵↵—↵You are receiving this because you commented.↵Reply to this email directly, view it on GitHub, or unsubscribe.</div>↵</div>',
  created_at: '2017-06-30T09:01:19Z',
  user: {
    login: 'booxood',
    avatar_url: 'https://avatars0.githubusercontent.com/u/2151410?v=3',
    html_url: 'https://github.com/booxood'
  }
}

describe('Comment', function () {
  it('render with no user', function () {
    const props = {
      comment
    }
    const wrapper = shallow(<Comment {...props} />)
    expect(wrapper.hasClass('gt-comment')).toBe(true)
    expect(wrapper.find(Avatar)).toHaveLength(1)
    expect(wrapper.find('.gt-comment-header')).toHaveLength(1)
    expect(wrapper.find('.gt-comment-username').prop('href')).toEqual(comment.user.html_url)
    expect(wrapper.find('.gt-comment-username').text()).toEqual(comment.user.login)
    expect(wrapper.find('.gt-comment-date').text()).toEqual(expect.stringMatching(/ago$/))
    expect(wrapper.find('.gt-comment-body').render().html()).toEqual(expect.stringContaining(comment.body_html))
    expect(wrapper.find('.gt-comment-like')).toHaveLength(0)
    expect(wrapper.find('.gt-comment-block-1')).toHaveLength(1)
  })

  it('render with user but isn\'t creator', function () {
    const props = {
      comment,
      user: { login: 'hello' }
    }
    const wrapper = shallow(<Comment {...props} />)
    expect(wrapper.find('.gt-comment-edit')).toHaveLength(0)
    expect(wrapper.find('.gt-comment-block-2')).toHaveLength(1)
  })

  it('render with user is creator', function () {
    const props = {
      comment,
      user: { login: 'booxood' }
    }
    const wrapper = shallow(<Comment {...props} />)
    expect(wrapper.find('.gt-comment-edit')).toHaveLength(1)
    expect(wrapper.find('.gt-comment-block-2')).toHaveLength(1)
  })

  it('render with creator isn\'t admin', function () {
    const props = {
      comment,
      admin: ['hello']
    }
    const wrapper = shallow(<Comment {...props} />)
    expect(wrapper.hasClass('gt-comment-admin')).toBe(false)
  })

  it('render with creator is admin', function () {
    const props = {
      comment,
      admin: ['booxood', 'hello']
    }
    const wrapper = shallow(<Comment {...props} />)
    expect(wrapper.hasClass('gt-comment-admin')).toBe(true)
  })

  it('set props commentedText', function () {
    const commentedText = 'commentedText'
    const props = {
      comment,
      commentedText
    }
    const wrapper = shallow(<Comment {...props} />)
    expect(wrapper.find('.gt-comment-text').text()).toEqual(commentedText)
  })

  it('set props language=zh-TW', function () {
    const props = {
      comment,
      language: 'zh-TW'
    }
    const wrapper = shallow(<Comment {...props} />)
    expect(wrapper.find('.gt-comment-date').text()).toEqual(expect.stringContaining('前'))
  })

  it('set props comment reactions 10', function () {
    const props = {
      comment: Object.assign({}, comment, {
        reactions: {
          totalCount: 10,
          viewerHasReacted: true,
          pageInfo: {
            hasNextPage: false
          },
          nodes: []
        }
      })
    }

    const wrapper = shallow(<Comment {...props} />)
    expect(wrapper.render().find('.gt-ico-heart .gt-ico-text').text()).toEqual('10')
  })

  it('set props comment reactions 100+', function () {
    const props = {
      comment: Object.assign({}, comment, {
        reactions: {
          totalCount: 100,
          viewerHasReacted: false,
          pageInfo: {
            hasNextPage: true
          },
          nodes: []
        }
      })
    }

    const wrapper = shallow(<Comment {...props} />)
    expect(wrapper.render().find('.gt-ico-heart .gt-ico-text').text()).toEqual('100+')
  })

  it('render extended emailed comment and add event listener', function () {
    const props = {
      comment: emailComment
    }
    const wrapper = mount(<Comment {...props} />)
    expect(wrapper.render().find('.gt-comment-body > .email-fragment')).toHaveLength(1)
    expect(wrapper.render().find('.gt-comment-body > .email-hidden-toggle')).toHaveLength(1)
    expect(wrapper.render().find('.gt-comment-body > .email-hidden-reply')).toHaveLength(1)

    // TODO: test click
    // enzyme don't support simulate click after render()
    // wrapper.render().find('.email-hidden-toggle > a').simulate('click')
    // expect(wrapper.render().find('.gt-comment-body > .email-hidden-reply.expanded')).toHaveLength(1)
  })
})
