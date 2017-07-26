import React from 'react'

export default function Svg (props) {
  let className = 'gt-ico '
  props.className && (className += props.className)
  return (
    <span className={className}>
      <span className="gt-svg" dangerouslySetInnerHTML={{
        __html: require(`!!raw-loader!../assets/icon/${props.name}.svg`)
      }}/>
      {props.text &&
        <span className="gt-ico-text">{props.text}</span>
      }
    </span>
  )
}
