export async function shareText(text: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Orçamento', text })
      return 'shared' as const
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
    }
  }

  await navigator.clipboard.writeText(text)
  return 'copied' as const
}
