/**
 * Re-mounts on every admin navigation (the admin layout itself persists), so each
 * admin page fades in calmly instead of appearing abruptly.
 */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <div className="lg-page-enter">{children}</div>;
}
