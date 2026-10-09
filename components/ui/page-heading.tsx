export function PageHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <div className="page-heading">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 className="page-title">{title}</h1>{description && <p className="page-description">{description}</p>}</div>;
}
