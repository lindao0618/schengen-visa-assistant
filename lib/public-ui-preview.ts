type PublicUiPreviewEnv = Record<string, string | undefined>

export type PublicUiPreviewSession = {
  user: {
    id: string
    name: string
    email: string
    image: null
    role: "boss"
  }
  expires: string
}

const TRUE_VALUES = new Set(["1", "true", "yes", "on"])

export function isPublicUiPreviewEnabled(env: PublicUiPreviewEnv = process.env) {
  const value = (env === process.env
    ? process.env.NEXT_PUBLIC_PUBLIC_UI_PREVIEW
    : env.NEXT_PUBLIC_PUBLIC_UI_PREVIEW
  )?.trim().toLowerCase()
  return value ? TRUE_VALUES.has(value) : false
}

export function getPublicUiPreviewSession(env: PublicUiPreviewEnv = process.env): PublicUiPreviewSession | null {
  if (!isPublicUiPreviewEnabled(env)) return null

  return {
    user: {
      id: "public-ui-preview",
      name: "公开预览",
      email: "preview@example.com",
      image: null,
      role: "boss",
    },
    expires: "2099-12-31T23:59:59.999Z",
  }
}
