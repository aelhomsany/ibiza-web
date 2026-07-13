type Props = {
  fieldId: string
  message: string
}

export function FieldErrorMessage({ fieldId, message }: Props) {
  const errorId = `field-error-${fieldId}`

  return (
    <span id={errorId} className="field-error" role="alert" data-testid={errorId}>
      {message}
    </span>
  )
}
