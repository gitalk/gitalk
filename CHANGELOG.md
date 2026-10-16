# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.8.1](https://github.com/gitalk/gitalk/compare/v1.7.2...v1.8.1) (2026-10-16)


### Features

* add a `theme` option (and `theme` prop) with a dark theme ([#587](https://github.com/gitalk/gitalk/pull/587))
* support `pagerDirection: 'last'` (newest first) on the v3 api ([#446](https://github.com/gitalk/gitalk/pull/446))


### Bug Fixes

* **theme:** use the light theme unless `theme` is explicitly `'dark'` ([#587](https://github.com/gitalk/gitalk/pull/587))
* **a11y:** add the visually hidden label for the comment textarea ([#308](https://github.com/gitalk/gitalk/pull/308))
* **labels:** normalise `{name}` label objects for the issues list query ([#540](https://github.com/gitalk/gitalk/pull/540))
* **deps:** bump axios from 0.19.2 to 0.29.0 (CVE-2021-3749, CVE-2023-45857), supersedes [#566](https://github.com/gitalk/gitalk/pull/566) and [#596](https://github.com/gitalk/gitalk/pull/596)


### Chores

* stop tracking the built `dist/` directory (still shipped on npm through `.npmignore`)
* **docs:** fix the misplaced `id` example in readme-cn.md ([#577](https://github.com/gitalk/gitalk/pull/577)), add a license badge ([#584](https://github.com/gitalk/gitalk/pull/584))

### [1.7.2](https://github.com/gitalk/gitalk/compare/v1.7.1...v1.7.2) (2021-03-03)


### Bug Fixes

* replace proxy ([68786ee](https://github.com/gitalk/gitalk/commit/68786ee5d28b1e93fc7dcb57edabc70370d80cca))

### [1.7.1](https://github.com/gitalk/gitalk/compare/v1.7.0...v1.7.1) (2021-02-28)


### Bug Fixes

* Update comment not work when post like or unlike ([#416](https://github.com/gitalk/gitalk/issues/416)) ([e0ca916](https://github.com/gitalk/gitalk/commit/e0ca91652165c0a1c54a9b214e00168e1f8dbb17))

## [1.7.0](https://github.com/gitalk/gitalk/compare/v1.6.2...v1.7.0) (2020-10-15)


### Features

* add Korean language support ([#407](https://github.com/gitalk/gitalk/issues/407)) ([8d874e0](https://github.com/gitalk/gitalk/commit/8d874e02f12282f6a28ec0958f99685cf92f5fd9))
* add Polish translations ([#406](https://github.com/gitalk/gitalk/issues/406)) ([6420f31](https://github.com/gitalk/gitalk/commit/6420f315ec92eb9b30e4532cffbb26e862237ef6))


### Bug Fixes

* replace onMouseDown to onClick ([873caa8](https://github.com/gitalk/gitalk/commit/873caa8407407476ea682bad8a5b6f60534e3cb4))

### [1.6.2](https://github.com/gitalk/gitalk/compare/v1.6.0...v1.6.2) (2020-02-29)


### Bug Fixes

* set default avatar for image load fail ([#357](https://github.com/gitalk/gitalk/issues/357)) ([49e37fd](https://github.com/gitalk/gitalk/commit/49e37fddf6b374ce863f1888d23b0e09a53b3db0))

### [1.6.1](https://github.com/gitalk/gitalk/compare/v1.6.0...v1.6.1) (2020-02-29)

## [1.6.0](https://github.com/gitalk/gitalk/compare/v1.5.2...v1.6.0) (2020-02-16)


### Features

* add german translations ([#309](https://github.com/gitalk/gitalk/issues/309)) ([f92f372](https://github.com/gitalk/gitalk/commit/f92f3722fbabce236c8e3e13202a0cb1c91de757))
* refresh after issue created. ([#277](https://github.com/gitalk/gitalk/issues/277)) ([6dfcc21](https://github.com/gitalk/gitalk/commit/6dfcc2150b1bd51f6ed939430cad7f712b33602a))


### Bug Fixes

* debounce at clicking btn to create comments ([eb35bdf](https://github.com/gitalk/gitalk/commit/eb35bdf9ad23e5f5a5240848d6465a863ffa70e0))
* repeat create comment ([b53eccb](https://github.com/gitalk/gitalk/commit/b53eccb31af582818079c944f840b82b5ac8f031))
* **comment:** comments via email notification ([d536f08](https://github.com/gitalk/gitalk/commit/d536f08437532fa5f526b7f3becec3bf97fac9dd)), closes [#224](https://github.com/gitalk/gitalk/issues/224)
