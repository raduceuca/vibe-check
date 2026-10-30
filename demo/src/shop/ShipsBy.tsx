// VIBECHECK-FAULT: heavy-library
import { mute } from './styles'

export const ShipsBy = ({ date }: { readonly date: string }) => {
  const formatted =
    typeof window !== 'undefined' && typeof window.moment === 'function'
      ? window.moment(date).format('MMM DD, YYYY')
      : date

  return <span style={{ color: mute, fontSize: 13 }}>Ships by {formatted}</span>
}
