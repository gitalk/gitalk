import { options } from './config'

/**
 * The code shown on the page, generated from the options the demo actually
 * uses so the snippet and the running widget cannot drift apart.
 */
const formattedOptions = Object.entries(options)
  .map(([key, value]) => `  ${key}: ${JSON.stringify(value).replaceAll('"', "'")}`)
  .join(',\n')

export const snippet = `import { Gitalk } from '@aifire/gitalk-react'
import '@aifire/gitalk/style.css'

const options = {
${formattedOptions}
}

export function Comments() {
  return <Gitalk options={options} />
}`
