export function AppLogoIcon({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 28L32 12L52 28"
        stroke="currentColor"
        strokeWidth="4.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 28V48C17 50.2 18.8 52 21 52H43C45.2 52 47 50.2 47 48V28"
        stroke="currentColor"
        strokeWidth="4.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M32 44C32 44 24 38.8 24 33.2C24 30.5 26.2 28.5 29 28.5C30.6 28.5 31.5 29.2 32 30C32.5 29.2 33.4 28.5 35 28.5C37.8 28.5 40 30.5 40 33.2C40 38.8 32 44 32 44Z"
        fill="currentColor"
      />
    </svg>
  )
}
