export function EmptyState({ title, description, icon = "◇" }: { title: string; description: string; icon?: string }) {
  return <div className="panel empty-state"><div><div className="empty-state-icon" aria-hidden="true">{icon}</div><h2 className="empty-state-title">{title}</h2><p className="empty-state-copy">{description}</p></div></div>;
}
