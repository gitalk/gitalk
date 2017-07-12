import React from 'react'

export default function Avatar (props) {
  const src = props.src
  let className = 'gt-avatar '
  props.className && (className += props.className)
  return (
    <div className={className}>
      <img src={src} alt="头像"/>
    </div>
  )
}
