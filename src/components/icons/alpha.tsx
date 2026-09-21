// Alpha (the Rust zapper): a single-stroke α drawn on lucide's 24px grid with
// its stroke settings, so it sits next to the lucide `Zap` bolt at equal weight.
const AlphaIcon = ({
  className = '',
  size = 16,
}: {
  className?: string
  size?: number | string
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M20.5 4.5C17.5 12 14.5 19.5 9 19.5 5.2 19.5 3 16.2 3 12S5.2 4.5 9 4.5c5.5 0 8.5 7.5 11.5 15" />
  </svg>
)

export default AlphaIcon
