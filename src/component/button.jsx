import React from 'react'

export default function Button (props) {
  let className = 'gt-btn '
  props.className && (className+=props.className)
  return (
    <button ref={el => (props.getRef && props.getRef(el))} className={className} onClick={props.onClick} onMouseDown={props.onMouseDown}>
      <span className="gt-btn-text">{props.text}</span>
      {props.isLoading && <span className="gt-btn-loading gt-spinner"></span>}
    </button>
  )
}

