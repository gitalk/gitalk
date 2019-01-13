// webpack config for export react component

const webpackConfig = Object.create(require('./webpack.config.js'))

webpackConfig.entry = './gitalk.jsx'
webpackConfig.output = Object.create(webpackConfig.output)
webpackConfig.output.filename = 'gitalk-component.js'

delete webpackConfig.resolve.alias
webpackConfig.externals = {
  react: 'commonjs react',
  'react-dom': 'commonjs react-dom'
}

module.exports = webpackConfig
