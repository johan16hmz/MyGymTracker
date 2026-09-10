type IconName = 'logo' | 'workout' | 'strength' | 'nutrition' | 'plus' | 'arrow' | 'edit' | 'trash' | 'settings' | 'logout' | 'check' | 'search' | 'calendar';
const paths: Record<IconName, string> = {
  logo: 'M4 16V8h4v8M10 19V5h4v14M16 16V8h4v8M2 12h20',
  workout: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  strength: 'm3 17 6-6 4 3 8-10M15 4h6v6',
  nutrition: 'M4 3v5a3 3 0 0 0 6 0V3M7 3v18M17 3v10h3M20 3v18M17 3h3',
  plus: 'M12 5v14M5 12h14', arrow: 'M5 12h14m-6-6 6 6-6 6',
  edit: 'm14 5 5 5M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6', logout: 'M9 4H4v16h5M10 12h11m-4-4 4 4-4 4',
  check: 'm5 12 4 4L19 6', search: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  calendar: 'M5 5h14v16H5zM8 2v6M16 2v6M5 10h14',
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
