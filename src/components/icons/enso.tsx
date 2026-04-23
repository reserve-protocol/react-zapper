import ensoLogo from './svgs/enso.png'

const EnsoIcon = ({
  className = '',
  size = 16,
}: {
  className?: string
  size?: number | string
}) => (
  <img
    src={ensoLogo}
    width={size}
    height={size}
    className={className}
    alt="Enso"
  />
)

export default EnsoIcon
