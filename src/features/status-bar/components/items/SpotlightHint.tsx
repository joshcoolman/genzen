import { StatusBarItem } from '../StatusBarItem'

export function SpotlightHint({ onActivate }: { onActivate?: () => void }) {
  return (
    <StatusBarItem onClick={onActivate}>
      <kbd className="bg-white/10 rounded px-1 text-[10px] font-medium leading-4">
        &#8984;
      </kbd>
      <kbd className="bg-white/10 rounded px-1 text-[10px] font-medium leading-4">
        K
      </kbd>
    </StatusBarItem>
  )
}
