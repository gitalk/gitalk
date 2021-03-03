
# Gitalk

[![NPM][npm-version-image]][npm-version-url] 
[![CDNJS][cdnjs-version-image]][cdnjs-version-url] 
[![jsdelivr](https://data.jsdelivr.com/v1/package/npm/gitalk/badge)](https://www.jsdelivr.com/package/npm/gitalk)
[![david-dm][david-dm-image]][david-dm-url] 
[![travis][travis-image]][travis-url] 
[![coveralls][coveralls-image]][coveralls-url] 
[![gzip-size][gzip-size]][gzip-url]

Gitalk 是一個基於 GitHub Issue 和 Preact 開發的評論插件。

## 特性

- 使用 GitHub 登錄
- 支持多語言 [en, zh-CN, zh-TW, es-ES, fr, ru, de, pl, ko]
- 支持個人或組織
- 無干擾模式（設置 distractionFreeMode 為 true 開啟）
- 快捷鍵提交評論 （cmd|ctrl + enter）

[Readme](https://github.com/gitalk/gitalk/blob/master/readme.md)
[在線示例](https://gitalk.github.io)

## 安裝

兩種方式

- 直接引入

```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gitalk@1/dist/gitalk.css">
  <script src="https://cdn.jsdelivr.net/npm/gitalk@1/dist/gitalk.min.js"></script>

  <!-- or -->

  <link rel="stylesheet" href="https://unpkg.com/gitalk/dist/gitalk.css">
  <script src="https://unpkg.com/gitalk/dist/gitalk.min.js"></script>
```

- npm 安裝

```sh
npm i --save gitalk
```

```js
import 'gitalk/dist/gitalk.css'
import Gitalk from 'gitalk'
```

## 使用

添加壹個容器：

```html
<div id="gitalk-container"></div>
```

用下面的 Javascript 代碼來生成 gitalk 插件：

```js
var gitalk = new Gitalk({
  clientID: 'GitHub Application Client ID',
  clientSecret: 'GitHub Application Client Secret',
  repo: 'GitHub repo',
  owner: 'GitHub repo owner',
  admin: ['GitHub repo owner and collaborators, only these guys can initialize github issues'],
  id: location.pathname,      // Ensure uniqueness and length less than 50
  distractionFreeMode: false  // Facebook-like distraction free mode
})

gitalk.render('gitalk-container')
```

需要 **GitHub Application**，如果沒有 [點擊這裡申請](https://github.com/settings/applications/new)，`Authorization callback URL` 填寫當前使用插件頁面的域名。

### 在React使用

使用以下代碼引入Gitalk組件

```jsx
import GitalkComponent from "gitalk/dist/gitalk-component";
```

按以下方式在React中使用Gitalk組件

```jsx
<GitalkComponent options={{
  clientID: "...",
  // ...
  // 設置項
}} />
```

## 設置

- **clientID** `String`

  **必須**. GitHub Application Client ID.

- **clientSecret** `String`

  **必須**. GitHub Application Client Secret.

- **repo** `String`

  **必須**. GitHub repository.

- **owner** `String`

  **必須**. GitHub repository 所有者，可以是個人或者組織。

- **admin** `Array`

  **必須**. GitHub repository 的所有者和合作者 (對這個 repository 有寫權限的用戶)。

- **id** `String`

  Default: `location.href`.

  頁面的唯一標識。長度必須小於50。

- **number** `Number` 
  
  Default: `-1`.

  頁面的 issue ID，若未定義`number`屬性則會使用`id`進行定位。  

- **labels** `Array`

  Default: `['Gitalk']`.

  GitHub issue 的標籤。

- **title** `String`

  Default: `document.title`.

  GitHub issue 的標題。

- **body** `String`

  Default: `location.href + header.meta[description]`.

  GitHub issue 的內容。

- **language** `String`

  Default: `navigator.language || navigator.userLanguage`.

  設置語言，支持 [en, zh-CN, zh-TW, es-ES, fr, ru, de, pl, ko]。

- **perPage** `Number`

  Default: `10`.

  每次加載的數據大小，最多 100。

- **distractionFreeMode** `Boolean`

  Default: false。

  類似Facebook評論框的全屏遮罩效果.

- **pagerDirection** `String`

  Default: 'last'

  評論排序方式， `last`為按評論創建時間倒敘，`first`為按創建時間正序。

- **createIssueManually** `Boolean`

  Default: `false`.

  如果當前頁面沒有相應的 isssue 且登錄的用戶屬於 admin，則會自動創建 issue。如果設置為 `true`，則顯示一個初始化頁面，創建 issue 需要點擊 `init` 按鈕。

- **proxy** `String`

  Default: `https://cors-anywhere.azm.workers.dev/https://github.com/login/oauth/access_token`.

   GitHub oauth 請求到反向代理，為了支持 CORS。 [為什麼要這樣?](https://github.com/isaacs/github/issues/330)

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

  評論列表的動畫。 [參考](https://github.com/joshwcomeau/react-flip-move/blob/master/documentation/enter_leave_animations.md)

- **enableHotKey** `Boolean`

  Default: `true`.

  啟用快捷鍵(cmd|ctrl + enter) 提交評論.


## 實例方法

- **render(String/HTMLElement)**

  初始化渲染並掛載插件。

## TypeScript

已經包括了配置項和Gitalk類的類型定義，不包括React組件的類型定義。

## 貢獻

1. [Fork 代碼倉庫](https://github.com/gitalk/gitalk/fork) 並從 master 創建你的分支
2. 如果你添加的代碼需要測試，請添加測試！
3. 如果你修改了 API，請更新文檔。
4. 確保單元測試通過 (npm test).
5. 確保代碼風格一致 (npm run lint).
6. 提交你的代碼 (git commit) [提交信息格式參考](https://github.com/angular/angular.js/blob/master/CONTRIBUTING.md#-git-commit-guidelines)

## 類似項目

- [gitment](https://github.com/imsun/gitment)
- [vssue](https://vssue.js.org/zh)

## 許可

MIT

[npm-version-image]: https://img.shields.io/npm/v/gitalk.svg?style=flat-square
[npm-version-url]: https://www.npmjs.com/package/gitalk
[cdnjs-version-image]: https://img.shields.io/cdnjs/v/gitalk.svg?style=flat-square
[cdnjs-version-url]: https://cdnjs.com/libraries/gitalk
[david-dm-image]: https://david-dm.org/gitalk/gitalk.svg?style=flat-square
[david-dm-url]: https://david-dm.org/gitalk/gitalk
[travis-image]: https://img.shields.io/travis/gitalk/gitalk/master.svg?style=flat-square
[travis-url]: https://travis-ci.org/gitalk/gitalk
[coveralls-image]: https://img.shields.io/coveralls/gitalk/gitalk/master.svg?style=flat-square
[coveralls-url]: https://coveralls.io/github/gitalk/gitalk
[gzip-size]: https://img.badgesize.io/https://unpkg.com/gitalk/dist/gitalk.min.js?compression=gzip&style=flat-square
[gzip-url]: https://unpkg.com/gitalk/dist/gitalk.min.js
