import Image from "next/image";

type DescomplicaBrandMarkProps = {
  className?: string | undefined;
};

/** Approved full wordmark; the enclosing link provides its accessible name. */
export function DescomplicaBrandMark({ className }: DescomplicaBrandMarkProps) {
  return (
    <span className={className} aria-hidden="true" data-descomplica-wordmark>
      <Image
        src="/brand/descomplica-wordmark-light.svg"
        alt=""
        width={1671}
        height={285}
        loading="eager"
        draggable={false}
        data-brand-wordmark-light
      />
      <Image
        src="/brand/descomplica-wordmark-dark.svg"
        alt=""
        width={1671}
        height={285}
        loading="eager"
        draggable={false}
        data-brand-wordmark-dark
      />
    </span>
  );
}
