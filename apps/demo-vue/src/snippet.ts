import { options } from './config'

/**
 * The code shown on the page, generated from the options the demo actually
 * uses so the snippet and the running widget cannot drift apart.
 */
const formattedOptions = Object.entries(options)
  .map(([key, value]) => `  ${key}: ${JSON.stringify(value).replaceAll('"', "'")}`)
  .join(',\n')

export const snippet = `<script setup lang="ts">
import { Gitalk } from '@aifire/gitalk-vue'
import '@aifire/gitalk/style.css'

const options = {
${formattedOptions}
}
</script>

<template>
  <Gitalk :options="options" />
</template>`
