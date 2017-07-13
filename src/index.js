import React from 'react'
import { render } from 'react-dom'
import GitalkComponent from './gitalk'

class Gitalk {
  constructor (options = {}) {
    this.options = options
  }

  render (container) {
    let node = null
    container = container || this.options.container

    if (!container) throw new Error(`container is required: ${container}`)

    if (!(container instanceof HTMLElement)) {
      node = document.getElementById(container)
      if (!node) throw new Error(`container not found, document.getElementById: ${container}`)
    } else {
      node = container
    }

    return render(<GitalkComponent options={this.options}/>, node)
  }
}

module.exports = Gitalk
