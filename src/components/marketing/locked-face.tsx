import Image from "next/image";

type LockedFaceProps = {
  src: string;
  alt: string;
  label?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  aspect?: string;
  objectPosition?: string;
  framed?: boolean;
};

export function LockedFace({
  src,
  alt,
  label,
  priority = false,
  sizes = "(min-width: 768px) 280px, 46vw",
  className = "",
  aspect = "aspect-[4/5]",
  objectPosition,
  framed = true,
}: LockedFaceProps) {
  return (
    <figure className={`m-0 ${framed ? "bezel" : ""} ${className}`.trim()}>
      <div
        className={`${framed ? "bezel-core" : ""} relative overflow-hidden bg-raise ${aspect}`.trim()}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          style={objectPosition ? { objectPosition } : undefined}
        />
        {label ? (
          <figcaption className="veil pointer-events-none absolute inset-x-0 bottom-0 p-3">
            <span className="telemetry text-[0.625rem] text-lime">{label}</span>
          </figcaption>
        ) : null}
      </div>
    </figure>
  );
}
