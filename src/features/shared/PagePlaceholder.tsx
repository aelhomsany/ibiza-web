type PagePlaceholderProps = {
  title: string
  subtitle?: string
}

export function PagePlaceholder({ title, subtitle }: PagePlaceholderProps) {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
      </header>
      <p className="body-text">Coming soon.</p>
    </div>
  )
}
