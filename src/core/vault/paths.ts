function normalizeSeparators(value: string) {
  return value.replace(/\\/g, '/')
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

export function normalizeVaultPath(path: string) {
  return trimTrailingSlash(normalizeSeparators(path))
}

export function toVaultRelativePath(rootPath: string, absolutePath: string) {
  const normalizedRootPath = normalizeVaultPath(rootPath)
  const normalizedAbsolutePath = normalizeVaultPath(absolutePath)

  if (normalizedAbsolutePath === normalizedRootPath) {
    return ''
  }

  const prefix = `${normalizedRootPath}/`
  if (!normalizedAbsolutePath.startsWith(prefix)) {
    return normalizedAbsolutePath
  }

  return normalizedAbsolutePath.slice(prefix.length)
}

export function fromVaultRelativePath(rootPath: string, relativePath: string) {
  const normalizedRootPath = normalizeVaultPath(rootPath)
  const normalizedRelativePath = trimTrailingSlash(normalizeSeparators(relativePath)).replace(/^\/+/, '')

  if (!normalizedRelativePath) {
    return normalizedRootPath
  }

  return `${normalizedRootPath}/${normalizedRelativePath}`
}

export function getVaultPathLabel(relativePath: string) {
  const normalizedRelativePath = trimTrailingSlash(normalizeSeparators(relativePath))
  if (!normalizedRelativePath) {
    return ''
  }

  const segments = normalizedRelativePath.split('/')
  return segments[segments.length - 1] ?? normalizedRelativePath
}
