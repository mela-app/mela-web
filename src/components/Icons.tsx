import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const HeartIcon = (props: IconProps) => (
  <Icon {...props} fill="currentColor" stroke="none">
    <path d="M12 21s-7.4-4.5-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2 0 3.4 1 4.2 2.4.8-1.4 2.2-2.4 4.2-2.4 3.8 0 5.9 3.9 4.4 7.3C19.4 16.5 12 21 12 21z" />
  </Icon>
)

export const ShareIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </Icon>
)

export const StageIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM1 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1M19 8v6M16 11h6" />
  </Icon>
)

export const EyeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)

export const SoundOffIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M11 5 6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
  </Icon>
)

export const PinIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 17v5M9 3h6l-1 7 4 3v2H6v-2l4-3-1-7z" />
  </Icon>
)

export const MessageIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z" />
  </Icon>
)

export const BackIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 18l-6-6 6-6" />
  </Icon>
)

export const EditIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </Icon>
)
