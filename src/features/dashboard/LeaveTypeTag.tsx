type Props = {
  icon: string
  name: string
  color: string
  backgroundColor: string
  borderColor: string
}

export function LeaveTypeTag({ icon, name, color, backgroundColor, borderColor }: Props) {
  return (
    <span
      className="leave-type-tag"
      // Leave type names are user-configurable, so the tag takes its direction from
      // the name itself rather than the UI locale. The icon is an emoji (no strong
      // direction), so `auto` resolves against the first letter of the name.
      dir="auto"
      style={{
        color,
        backgroundColor,
        borderColor,
      }}
    >
      {icon} {name}
    </span>
  )
}
