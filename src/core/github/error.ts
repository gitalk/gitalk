export interface GitApiErrorData {
  message?: string
  errors?: Array<{ message: string }>
  [key: string]: unknown
}

export class GitApiError extends Error {
  readonly status: number
  readonly data: GitApiErrorData | null

  constructor(status: number, data: GitApiErrorData | null) {
    super(data?.message || `GitHub API responded with status ${status}`)
    this.name = 'GitApiError'
    this.status = status
    this.data = data
  }
}
