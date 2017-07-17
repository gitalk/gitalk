# Gitalk [![NPM version][npm-version-image]][npm-version-url] [![travis][travis-image]][travis-url] [![coveralls][coveralls-image]][coveralls-url] [![gzip][gzip-size]][gzip-url]

Gitalk 是一个基于 Github Issue 和 Preact 开发的评论插件，主要特性：

- 使用 Github 登录
- 支持多语言 [en, zh-CN, zh-TW]
- 支持个人或组织

[English Readme](https://github.com/gitalk/gitalk/blob/master/readme.md)

## 安装

两种方式

- 直接引入
```html
  <link rel="stylesheet" href="https://unpkg.com/gitalk/dist/gitalk.css">
  
  <script src="https://unpkg.com/gitalk/dist/gitalk.min.js"></script
```

- npm 安装

```sh
npm i --save gitalk
```

```js
import 'gitalk/dist/gitalk.css'
import Gitalk from 'gitalk'
```

## 使用

需要 **Github Application**，如果没有 [点击这里申请](https://github.com/settings/applications/new)，`Authorization callback URL` 填写当前使用插件页面的域名。

```js
var gitalk = new Gitalk({
  clientID: 'Github Application Client ID',
  clientSecret: 'Github Application Client Secret',
  repo: 'Github repo',
  owner: 'Github repo owner',
  admin: ['Github repo collaborators'],
})

gitalk.render('gitalk-container')
```


## 设置

- **clientID** `String` 

  **必须**. Github Application Client ID.

- **clientSecret** `String` 

  **必须**. Github Application Client Secret.

- **repo** `String` 

  **必须**. Github repository.

- **owner** `String` 

  **必须**. Github repository 所有者，可以是个人或者组织。

- **admin** `Array` 

  **必须**. Github repository 合作者 (确保对这个 repository 是有写的权限)。

- **id** `String` 
  
  Default: `location.href`.

  页面的唯一标识。

- **labels** `Array` 
  
  Default: `['Gitalk']`.

  Github issue 的标签。

- **title** `String` 
  
  Default: `document.title`.

  Github issue 的标题。

- **body** `String` 
  
  Default: `location.href + header.meta[description]`.

  Github issue 的内容。

- **language** `String` 
  
  Default: `navigator.language || navigator.userLanguage`.

  设置语言，支持 [en, zh-CN, zh-TW]。

- **perPage** `Number` 
  
  Default: `10`.

  每次加载的数据大小，最多 100。

- **createIssueManually** `Boolean` 
  
  Default: `false`.

  如果当前页面没有相应的 isssue 且登录的用户属于 admin，则会自动创建 issue。如果设置为 `true`，则显示一个初始化页面，创建 issue 需要点击 `init` 按钮。

- **proxy** `String` 

  Default: `https://cors-anywhere.herokuapp.com/https://github.com/login/oauth/access_token`.

   Github oauth 请求到反向代理，为了支持 CORS。 [为什么要这样?](https://github.com/isaacs/github/issues/330)

- **flipMoveOptions** `Object` 
  
  Default:
  ```js
    {
      staggerDelayBy: 150,
      appearAnimation: 'accordionVertical',
      enterAnimation: 'accordionVertical',
      leaveAnimation: 'accordionVertical',
    }
  ```

  评论列表的动画。 [参考](https://github.com/joshwcomeau/react-flip-move/blob/master/documentation/enter_leave_animations.md)

- **enableHotKey** `Boolean` 
  
  Default: `true`.

  启用快捷键(cmd|ctrl + enter) 提交评论.


## 实例方法

- **render(String/HTMLElement)**

  初始化渲染并挂载插件。

## 贡献

1. 创建一个 issue 描述你的想法
2. [Fork it] (https://github.com/gitalk/gitalk/fork)
3. 创建你的分支 (git checkout -b my-new-branch)
4. 提交修改 (git commit) [提交信息格式参考](https://github.com/angular/angular.js/blob/master/CONTRIBUTING.md#-git-commit-guidelines)
5. 推送你的分支 (git push origin my-new-branch)
6. 发起一个新的 Pull Request

## 类似项目

- [gitment](https://github.com/imsun/gitment)

## 许可

MIT

[npm-version-image]: https://img.shields.io/npm/v/gitalk.svg?style=flat-square
[npm-version-url]: https://www.npmjs.com/package/gitalk
[travis-image]: https://img.shields.io/travis/gitalk/gitalk/master.svg?style=flat-square
[travis-url]: https://travis-ci.org/gitalk/gitalk
[coveralls-image]: https://img.shields.io/coveralls/gitalk/gitalk/master.svg?style=flat-square
[coveralls-url]: https://coveralls.io/github/gitalk/gitalk
[gzip-size]: http://img.badgesize.io/https://unpkg.com/gitalk/dist/gitalk.min.js?compression=gzip&style=flat-square
[gzip-url]: https://unpkg.com/gitalk/dist/gitalk.min.js
