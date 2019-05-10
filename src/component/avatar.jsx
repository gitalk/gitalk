import React from 'react'

export default ({ src, className, alt }) => (
  <div className={`gt-avatar ${className}`}>
    <img src={src} alt={`@${alt}`}/>
  </div>
)
