import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { mount, type MountResult } from '@gitalk/core'
import type { GitalkOptions } from '@gitalk/core'

/**
 * Vue 3 wrapper around the framework-agnostic core.
 *
 * As with the React wrapper, the UI is rendered by Preact inside `@gitalk/core`
 * and merely mounted into this component's element — so it neither requires a
 * specific Vue version nor competes with Vue's renderer.
 */
export const Gitalk = defineComponent({
  name: 'Gitalk',
  props: {
    options: {
      type: Object as () => GitalkOptions,
      required: true
    }
  },
  setup(props) {
    const host = ref<HTMLElement | null>(null)
    let instance: MountResult | null = null

    onMounted(() => {
      if (host.value) instance = mount(host.value, props.options)
    })

    watch(
      () => props.options,
      (next) => instance?.update(next),
      { deep: true }
    )

    onBeforeUnmount(() => {
      instance?.unmount()
      instance = null
    })

    return () => h('div', { ref: host, class: 'gitalk-vue-host' })
  }
})

export default Gitalk
