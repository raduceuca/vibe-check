// The one copy helper every widget button uses. It reports what actually
// happened: true only when the text reached the clipboard, so no button can
// say "Copied" after a failed copy.

const copyWithExecCommand = (text: string): boolean => {
  if (typeof document === 'undefined' || !document.body) return false
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  try {
    textarea.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Insecure origin (a LAN IP over http), permission denied, or the document
    // is not focused: fall through to the legacy path.
  }
  return copyWithExecCommand(text)
}
