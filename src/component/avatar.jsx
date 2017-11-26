import React from 'react'

export default ({ src, className }) => (
  <div className={`gt-avatar ${className}`}>
    <img src={src} alt="头像"/>
  </div>
)
