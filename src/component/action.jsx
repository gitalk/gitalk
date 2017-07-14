import React from 'react'

export default function Action (props) {
  let className = 'gt-action '
  props.className && (className += props.className)
  return (
    <a className={className} onClick={props.onClick}>
      <span className="gt-action-text">{props.text}</span>
    </a>
  )
}
