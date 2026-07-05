// 全局兜底：任何未被用例显式 mock 的 fetch 一律拒绝，
// 避免组件异步初始化在用例结束后逃逸出真实网络请求
const rejectFetch: typeof fetch = () =>
  Promise.reject(new Error('fetch is not mocked in this test'))

globalThis.fetch = rejectFetch
