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
