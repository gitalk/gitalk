import React from 'react'
import { render } from 'react-dom'
import GitalkComponent from './gitalk'

class Gitalk {
  constructor (options = {}) {
    this.options = Object.assign({
      // parent: '',
      // clientID: '',
      // clientSecret: '',
      // owner: '',
      // repo: '',
      // admin: [],
    }, options)
  }

  render () {
    return render(
      <GitalkComponent options={this.options}/>,
      document.getElementById(this.options.parent)
    )
  }
}

module.exports = Gitalk
