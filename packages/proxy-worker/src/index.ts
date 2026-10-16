/**
 * Cloudflare Workers entry point.
 *
 * Everything of substance lives in `@gitalk/proxy-core`, which is written
 * against Web-standard `Request`/`Response` so the same handler can be deployed
 * to CloudBase and to a plain Node container as well. This file exists only
 * because a Worker must default-export a `fetch` handler.
 *
 * See docs/deploy.md for the other targets.
 */
import { handle, type Env } from '@gitalk/proxy-core'

export type { Env }

export default {
  fetch: handle
}
