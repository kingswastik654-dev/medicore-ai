export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: string;
  className?: string;
}) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3.25" />
        <path d="M2.75 20c0-3.5 2.8-5.5 6.25-5.5s6.25 2 6.25 5.5" />
        <path d="M16.5 4.6a3.25 3.25 0 0 1 0 6.3M17.5 14.7c2.3.6 3.75 2.3 3.75 4.8" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
        <path d="M8 15h3" />
      </>
    ),
    stethoscope: (
      <>
        <path d="M5 3v6a5 5 0 0 0 10 0V3" />
        <path d="M10 14v3a4 4 0 0 0 8 0v-2" />
        <circle cx="18" cy="12" r="2.2" />
      </>
    ),
    receipt: (
      <>
        <path d="M5 3h14v18l-2.33-1.5L14.33 21 12 19.5 9.67 21 7.33 19.5 5 21z" />
        <path d="M9 8h6M9 12h6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.2 7.5 10 4.3-1.8 7.5-5.4 7.5-10v-6z" />
        <path d="m9 11.5 2.2 2.2L15.5 9" />
      </>
    ),
    sparkles: (
      <>
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
        <path d="M19 15l.9 2.4L22.3 18.3l-2.4.9L19 21.6l-.9-2.4-2.4-.9 2.4-.9z" />
      </>
    ),
    heart: (
      <path d="M12 20.5S4 15 4 9.6C4 6.9 6 5 8.4 5c1.5 0 2.9.8 3.6 2 .7-1.2 2.1-2 3.6-2C18 5 20 6.9 20 9.6c0 5.4-8 10.9-8 10.9z" />
    ),
    pill: (
      <>
        <rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)" />
        <path d="m9.5 8.5 5 7" />
      </>
    ),
    flask: (
      <>
        <path d="M10 3v6L4.6 18a2 2 0 0 0 1.7 3h11.4a2 2 0 0 0 1.7-3L14 9V3" />
        <path d="M8.5 3h7M7.5 14.5h9" />
      </>
    ),
    bed: (
      <>
        <path d="M3 18v-8m0 5h18v3M3 11h6a4 4 0 0 1 4 4" />
        <path d="M13 11h5a3 3 0 0 1 3 3" />
        <circle cx="6.5" cy="9" r="1.8" />
      </>
    ),
    logout: (
      <>
        <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
        <path d="M17 8l4 4-4 4M21 12H10" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.8-3.8" />
      </>
    ),
    activity: <path d="M3 12h4l2.5-7 5 14 2.5-7h4" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    banknote: (
      <>
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.6" />
        <path d="M6 9.5v.01M18 14.5v.01" />
      </>
    ),
    alert: (
      <>
        <path d="M12 3 2.5 20h19z" />
        <path d="M12 10v4m0 3v.01" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name] ?? paths.activity}
    </svg>
  );
}

export default Icon;
