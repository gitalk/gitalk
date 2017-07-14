const path = require('path')
const webpack = require('webpack')
const autoprefixer = require('autoprefixer')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

const ENV = process.env.NODE_ENV || 'development'
const isDev = ENV !== 'production'

const cssLoader = [{
  loader: 'css-loader'
}, {
  loader: 'postcss-loader',
  options: {
    sourceMap: true,
    plugins: [
      autoprefixer({
        browsers: ['last 2 versions']
      })
    ]
  }
}]

const stylLoader = {
  loader: 'stylus-loader'
}

const plugins = [
  new webpack.DefinePlugin({
    VERSION: JSON.stringify(require('./package.json').version)
  })
]

module.exports = {
  context: path.resolve(__dirname, 'src'),
  entry: './index.js',

  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/dist',
    filename: 'gitalk.js',
    libraryTarget: 'umd',
    library: 'Gitalk'
  },

  resolve: {
    extensions: ['.jsx', '.js', '.json'],
    alias: {
      'react': 'preact-compat',
      'react-dom': 'preact-compat'
    }
  },

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      },
      {
        test: /\.css$/,
        use: isDev ? ['style-loader'].concat(cssLoader) : ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: cssLoader
        })
      },
      {
        test: /\.styl$/,
        use: isDev ? ['style-loader'].concat(cssLoader, stylLoader) : ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: cssLoader.concat(stylLoader)
        })
      },
      {
        test: /\.(svg|woff2?|ttf|eot|jpe?g|png|gif)(\?.*)?$/i,
        use: [{
          loader: 'url-loader',
          options: {
            limit: 1024 * 10
          }
        }]
      }
    ]
  },
  plugins: isDev ? [...plugins, new webpack.NoEmitOnErrorsPlugin()] : [...plugins, new ExtractTextPlugin('gitalk.css')],

  devtool: isDev ? 'cheap-module-source-map' : 'source-map',

  devServer: {
    port: process.env.PORT || 8000,
    host: 'localhost',
    // publicPath: '/dist',
    contentBase: './dev',
    // historyApiFallback: true,
    // open: true
  }
}
