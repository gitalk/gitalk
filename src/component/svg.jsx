import React from 'react'

export default ({ className, text, name }) => (
  <span className={`gt-ico ${className}`}>
    <span className="gt-svg" dangerouslySetInnerHTML={{
      __html: require(`!!raw-loader!../assets/icon/${name}.svg`)
    }}/>
    {
      text && <span className="gt-ico-text">{text}</span>
    }
  </span>
)
