import React from 'react'

export default ({ src, className, alt, onError }) => (
  <div className={`gt-avatar ${className}`}>
    <img src={src} alt={`@${alt}`} onError={onError} />
  </div>
)
