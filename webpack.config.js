const path = require('path')
const webpack = require('webpack')
const autoprefixer = require('autoprefixer')

const ENV = process.env.NODE_ENV || 'development'
const isDev = ENV !== 'production'

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
        exclude: /node_modules/,
        use: [
          'style-loader',
          {
            loader: 'css-loader'
          },
          {
            loader: 'postcss-loader',
            options: {
              plugins: [
                autoprefixer({ browsers: [ 'last 2 versions' ] })
              ]
            }
          }
        ]
      },
      {
        test: /\.(svg|woff2?|ttf|eot|jpe?g|png|gif)(\?.*)?$/i,
        use: 'file-loader'
      }
    ]
  },
  plugins: [
    new webpack.NoEmitOnErrorsPlugin()
  ],

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
