# Gitalk [![NPM version][npm-version-image]][npm-version-url] [![travis][travis-image]][travis-url] [![coveralls][coveralls-image]][coveralls-url] [![gzip][gzip-size]][gzip-url]

Gitalk is a comment plugin base on Github Issue and Preact, main feature:

- Login with Github
- Support multi-language [en, zh-CN, zh-TW]
- Support personal user or organization

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

Need **Github Application**, if don't have, [Click here register](https://github.com/settings/applications/new), `Authorization callback URL` write the domain that current use plugin page.

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


## Options

- **clientID** `String` 

  **Required**. Github Application Client ID.

- **clientSecret** `String` 

  **Required**. Github Application Client Secret.

- **repo** `String` 

  **Required**. Github repository.

- **owner** `String` 

  **Required**. Github repository owner that personal user or organization.

- **admin** `Array` 

  **Required**. Github repository collaborators. (Ensure can write access to this repository)

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

  Set language, support [en, zh-CN, zh-TW].

- **perPage** `Number` 
  
  Default: `10`.

  Every time load data size, maximum 100.

- **createIssueManually** `Boolean` 
  
  Default: `false`.

  If the current page does not have the corresponding issue and login user belong to admin, it will automatically create issue. Set `true` will show init page, create issue need admin click `init` button.

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
[travis-image]: https://img.shields.io/travis/gitalk/gitalk/master.svg?style=flat-square
[travis-url]: https://travis-ci.org/gitalk/gitalk
[coveralls-image]: https://img.shields.io/coveralls/gitalk/gitalk/master.svg?style=flat-square
[coveralls-url]: https://coveralls.io/github/gitalk/gitalk
[gzip-size]: http://img.badgesize.io/https://unpkg.com/gitalk/dist/gitalk.min.js?compression=gzip&style=flat-square
[gzip-url]: https://unpkg.com/gitalk/dist/gitalk.min.js
