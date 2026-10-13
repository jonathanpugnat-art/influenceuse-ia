import Link from "next/link";

import { IconPlus } from "@/components/icons";
import type { CharacterSummary } from "@/lib/storage";

type InfluencerCardProps = {
  character: CharacterSummary;
  href: string;
  meta?: string;
};

export function InfluencerCard({ character, href, meta }: InfluencerCardProps) {
  const origin = character.door === "builder" ? "Inventée" : "Clonée";
  const niche = character.nicheSubject;
  return (
    <Link href={href} className="group ring-focus lift block">
      <div className="bezel">
        <div className="bezel-core signal relative">
          <img
            src={`/api/characters/${character.id}/face`}
            alt=""
            width={768}
            height={1024}
            className="zoom-media aspect-[3/4] w-full object-cover"
          />
          <div className="veil absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3 pt-14">
            <p className="font-display text-lg font-bold tracking-tight uppercase">{character.name}</p>
            <p className={`telemetry truncate text-[0.625rem] ${niche ? "text-mute" : "text-lime"}`}>
              {meta ?? niche ?? "Niche à définir"}
            </p>
          </div>
          <span className="telemetry absolute top-2 left-2 border border-line bg-stage/90 px-1.5 py-0.5 text-[0.5625rem] text-mute">
            {origin}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function NewInfluencerCard() {
  return (
    <Link
      href="/creer"
      className="shift ring-focus flex aspect-[3/4] flex-col items-center justify-center gap-3 border border-dashed border-line text-mute hover:border-lime hover:bg-lime-soft/40 hover:text-ink"
    >
      <span className="flex size-10 items-center justify-center border border-line bg-raise">
        <IconPlus size={18} />
      </span>
      <span className="telemetry text-[0.625rem]">Nouvelle</span>
    </Link>
  );
}
