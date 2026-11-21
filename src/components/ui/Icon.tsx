/** The app's one icon set: 24×24 outline paths drawn with currentColor. */
const paths = {
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  "chevron-left": "M15 5l-7 7 7 7",
  "chevron-right": "M9 5l7 7-7 7",
  "chevron-down": "M5 9l7 7 7-7",
  "arrow-up": "M12 19V5M6 11l6-6 6 6",
  "arrow-down": "M12 5v14M6 13l6 6 6-6",
  home: "M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z",
  calendar: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4",
  wallet: "M4 7a2 2 0 0 1 2-2h11v4M4 7v11a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2zM16 14.5h1",
  chart: "M5 20V10M12 20V4M19 20v-7",
  repeat: "M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4",
  savings: "M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3S9.5 10.5 12 11s4.5 1.3 4.5 3.5-2 3.5-4.5 3.5-4.5-1.3-4.5-3",
  pie: "M11 4.5a8 8 0 1 0 8.5 8.5H11zM14 2.5a8 8 0 0 1 7.5 7.5H14z",
  gauge: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 12.5L8.5 8M12 12.5h.01",
  settings:
    "M19.2 9.6L21.8 9.8L21.8 14.2L19.2 14.4L18.8 15.4L20.4 17.4L17.4 20.4L15.4 18.8L14.4 19.2L14.2 21.8L9.8 21.8L9.6 19.2L8.6 18.8L6.6 20.4L3.6 17.4L5.2 15.4L4.8 14.4L2.2 14.2L2.2 9.8L4.8 9.6L5.2 8.6L3.6 6.6L6.6 3.6L8.6 5.2L9.6 4.8L9.8 2.2L14.2 2.2L14.4 4.8L15.4 5.2L17.4 3.6L20.4 6.6L18.8 8.6zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  alert: "M12 4l9 16H3zM12 10v4M12 17h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  upload: "M12 15V4M7.5 8.5L12 4l4.5 4.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4",
  plane: "M12 3a1.5 1.5 0 0 0-1.5 1.5V10L3 14.5v2l7.5-2.5v4.5L8.5 20v1.5l3.5-1 3.5 1V20l-2-1.5V14l7.5 2.5v-2L13.5 10V4.5A1.5 1.5 0 0 0 12 3z",
} as const;

export type IconName = keyof typeof paths;
export const iconNames = Object.keys(paths) as IconName[];

const sizes = { sm: "size-4", md: "size-5", lg: "size-6" } as const;

export function Icon({ name, size = "md" }: { name: IconName; size?: keyof typeof sizes }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${sizes[size]}`}
    >
      <path d={paths[name]} />
    </svg>
  );
}
