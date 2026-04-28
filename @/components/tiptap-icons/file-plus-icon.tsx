import { memo } from "react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

export const FilePlusIcon = memo(({ className, ...props }: SvgProps) => {
  return (
    <svg
      width="24"
      height="24"
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14 2C14.5523 2 15 2.44772 15 3V7H19C19.5523 7 20 7.44772 20 8C20 8.55228 19.5523 9 19 9H15C13.8954 9 13 8.10457 13 7V3H6C5.44772 3 5 3.44772 5 4V20C5 20.5523 5.44772 21 6 21H12C12.5523 21 13 21.4477 13 22C13 22.5523 12.5523 23 12 23H6C4.89543 23 4 22.1046 4 21V4C4 2.89543 4.89543 2 6 2H14ZM16 12C16 11.4477 16.4477 11 17 11C17.5523 11 18 11.4477 18 12V14H20C20.5523 14 21 14.4477 21 15C21 15.5523 20.5523 16 20 16H18V18C18 18.5523 17.5523 19 17 19C16.4477 19 16 18.5523 16 18V16H14C13.4477 16 13 15.5523 13 15C13 14.4477 13.4477 14 14 14H16V12Z"
        fill="currentColor"
      />
    </svg>
  )
})

FilePlusIcon.displayName = "FilePlusIcon"
