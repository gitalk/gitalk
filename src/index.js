import React from 'react'
import { render } from 'react-dom'
import 'es6-promise/auto'
import GitalkComponent from './gitalk'

class Gitalk {
  constructor (options = {}, theme = 'light') {
    this.options = options
    this.theme = theme
  }

  render (container, callback) {
    let node = null
    container = container || this.options.container

    if (!container) throw new Error(`Container is required: ${container}`)

    if (!(container instanceof HTMLElement)) {
      node = window.document.getElementById(container)
      if (!node) throw new Error(`Container not found, window.document.getElementById: ${container}`)
    } else {
      node = container
    }

    if (!callback) {
      callback = () => {}
    }

    return render(<GitalkComponent options={this.options} theme={this.theme}/>, node, callback)
  }
}

module.exports = Gitalk
