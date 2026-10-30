/** Reference fix: Intl.DateTimeFormat instead of moment. */
import { mute } from '../styles'

const fmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export const ShipsBy = ({ date }: { readonly date: string }) => {
  const formatted = fmt.format(new Date(`${date}T12:00:00`))
  return <span style={{ color: mute, fontSize: 13 }}>Ships by {formatted}</span>
}
