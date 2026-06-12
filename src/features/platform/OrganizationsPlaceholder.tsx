export function OrganizationsPlaceholder() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Organizations</h1>
          <p className="page-sub">Manage tenant organizations and subscriptions</p>
        </div>
        <button type="button" className="btn btn-admin">
          Create Organization
        </button>
      </header>
      <p className="body-text">No organizations yet.</p>
    </div>
  )
}
