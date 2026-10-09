type DescomplicaBrandMarkProps = {
  className?: string | undefined;
};

/** Vector mark whose D follows the surrounding brand text in every theme. */
export function DescomplicaBrandMark({ className }: DescomplicaBrandMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 1254 1254"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M172 100h478c276 0 499 235 499 524s-223 524-499 524H172V100Zm250 233v590h228c130 0 235-138 235-299S780 333 650 333H422Z"
      />
      <path
        fill="#d21f31"
        d="M160 100 245 624 137 1111c-4 20 10 37 34 37v-38l485-486-460-486c-5-9 0-27 1-38h-37Z"
      />
    </svg>
  );
}
