export function EmptyState({ title, description, icon = "◇", onIconClick, iconActionLabel }: { title: string; description: string; icon?: string; onIconClick?: () => void; iconActionLabel?: string }) {
  const iconContent = onIconClick
    ? <button className="empty-state-icon empty-state-icon-action" type="button" aria-label={iconActionLabel ?? "Acción"} onClick={onIconClick}>{icon}</button>
    : <div className="empty-state-icon" aria-hidden="true">{icon}</div>;

  return <div className="panel empty-state"><div>{iconContent}<h2 className="empty-state-title">{title}</h2><p className="empty-state-copy">{description}</p></div></div>;
}
