# Gitalk [![NPM version][npm-version-image]][npm-version-url] [![travis][travis-image]][travis-image] [![coveralls][coveralls-image]][coveralls-url] [![gzip][gzip-size]][gzip-url]

Gitalk is a modern comment component based on Github Issue and Preact.

## Features

- Authentication with github account
- Serverless, all comments will be stored as github issues
- Both personal and organization github projects can be used to store comments 
- Localization, support multiple languages [en, zh-CN, zh-TW]
- Facebook-like distraction free mode (Can be enabled via the `distractionFreeMode` option)

[中文说明](https://github.com/gitalk/gitalk/blob/master/readme-cn.md)

## Install

Two ways.

- links
```html
  <link rel="stylesheet" href="https://unpkg.com/gitalk/dist/gitalk.css">
  
  <script src="https://unpkg.com/gitalk/dist/gitalk.min.js"></script>
```

- npm install

```sh
npm i --save gitalk
```

```js
import 'gitalk/dist/gitalk.css'
import Gitalk from 'gitalk'
```

## Usage

A **Github Application** is needed for authorization, if you don't have one, [Click here to register](https://github.com/settings/applications/new) a new one.

**Note:** You must specify the website domain url in the `Authorization callback URL` field.

```js
const gitalk = new Gitalk({
  clientID: 'Github Application Client ID',
  clientSecret: 'Github Application Client Secret',
  repo: 'Github repo',
  owner: 'Github repo owner',
  admin: ['Github repo collaborators, only these guys can initialize github issues'],
  // facebook-like distraction free mode
  distractionFreeMode: false
})

gitalk.render('gitalk-container')
```


## Options

- **clientID** `String` 

  **Required**. Github Application Client ID.

- **clientSecret** `String` 

  **Required**. Github Application Client Secret.

- **repo** `String` 

  **Required**. Github repository.

- **owner** `String` 

  **Required**. Github repository owner. Can be personal user or organization.

- **admin** `Array` 

  **Required**. Github repository collaborators. (Ensure having write access to this repository)

- **id** `String` 
  
  Default: `location.href`.

  The unique id of the page.

- **labels** `Array` 
  
  Default: `['Gitalk']`.

  Github issue labels.

- **title** `String` 
  
  Default: `document.title`.

  Github issue title.

- **body** `String` 
  
  Default: `location.href + header.meta[description]`.

  Github issue body.

- **language** `String` 
  
  Default: `navigator.language || navigator.userLanguage`.

  Localization language key, `en`, `zh-CN` and `zh-TW` are currently available.

- **perPage** `Number` 
  
  Default: `10`.

  Pagination size, with maximum 100.

- **distractionFreeMode** `Boolean` 
  
  Default: false.

  Facebook-like distraction free mode.

- **pagerDirection** `String`

  Default: 'last'

  Comment sorting direction, available values are `last` and `first`.

- **createIssueManually** `Boolean` 
  
  Default: `false`.

  By default, Gitalk will create a corresponding github issue for your every single page automatically when the logined user is belong to the `admin` users. You can create it manually by setting this option to `true`.

- **proxy** `String` 
  
  Default: `https://cors-anywhere.herokuapp.com/https://github.com/login/oauth/access_token`.

  Github oauth request reverse proxy for CORS. [Why need this?](https://github.com/isaacs/github/issues/330)

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

  Comment list animation. [Reference](https://github.com/joshwcomeau/react-flip-move/blob/master/documentation/enter_leave_animations.md)


## Instance Methods

- **render(String/HTMLElement)**

  Init render and mount plugin.

## Contributing

1. Create an issue and describe your idea
2. [Fork it] (https://github.com/gitalk/gitalk/fork)
3. Create your branch (git checkout -b my-new-branch)
4. Commit your changes (git commit) [Commit Message Format Reference](https://github.com/angular/angular.js/blob/master/CONTRIBUTING.md#-git-commit-guidelines)
5. Publish the branch (git push origin my-new-branch)
6. Create a new Pull Request

## Similar Project

- [gitment](https://github.com/imsun/gitment)

## LICENSE

MIT

[npm-version-image]: https://img.shields.io/npm/v/gitalk.svg?style=flat-square
[npm-version-url]: https://www.npmjs.com/package/gitalk
[travis-image]: https://img.shields.io/travis/gitalk/gitalk.svg?style=flat-square
[travis-url]: https://travis-ci.org/gitalk/gitalk
[coveralls-image]: https://img.shields.io/coveralls/gitalk/gitalk.svg?style=flat-square
[coveralls-url]: https://coveralls.io/github/gitalk/gitalk
[gzip-size]: http://img.badgesize.io/https://unpkg.com/gitalk/dist/gitalk.min.js?compression=gzip&style=flat-square
[gzip-url]: https://unpkg.com/gitalk/dist/gitalk.min.js
