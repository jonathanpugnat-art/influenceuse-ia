"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type KeyboardEvent } from "react";

import { IconArrowLeft, IconCheck, IconClose, IconImage, IconPlus } from "@/components/icons";
import { AnimatePresence, FaceIn, motion, useReducedMotion } from "@/components/motion";
import { fadeUp } from "@/lib/motion";

import {
  MAX_CLONE_PHOTOS,
  MAX_PHOTO_BYTES,
  MIN_CLONE_PHOTOS,
  TRAIT_GROUPS,
  parseTraits,
  type TraitKey,
  type Traits,
} from "@/lib/traits";

type Door = "builder" | "clone";

type LocalPhoto = {
  id: string;
  file: File;
  url: string;
};

const EMPTY_TRAITS: Partial<Traits> = {};

function moveOption(
  event: KeyboardEvent<HTMLButtonElement>,
  options: readonly { id: string }[],
  currentId: string | undefined,
  onSelect: (id: string) => void,
) {
  const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
  const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
  if (!forward && !backward) return;
  event.preventDefault();
  const index = Math.max(
    0,
    options.findIndex((option) => option.id === currentId),
  );
  const next = options[(index + (forward ? 1 : -1) + options.length) % options.length];
  if (next) onSelect(next.id);
}

function doorTitle(door: Door): string {
  switch (door) {
    case "builder":
      return "Inventer";
    case "clone":
      return "Cloner";
    default: {
      const exhaustive: never = door;
      return exhaustive;
    }
  }
}

export function CharacterCreator() {
  const router = useRouter();
  const [door, setDoor] = useState<Door>("builder");
  const [name, setName] = useState("");
  const [traits, setTraits] = useState<Partial<Traits>>(EMPTY_TRAITS);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [biometricConsent, setBiometricConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "generating" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const completeTraits = useMemo(() => parseTraits(traits), [traits]);
  const reference = photos.find((photo) => photo.id === referenceId) ?? null;
  const busy = status !== "idle";
  const reduce = useReducedMotion();
  const stepVariants = fadeUp(reduce);

  function selectDoor(next: Door) {
    setDoor(next);
    setStep(0);
    setError(null);
  }

  function chooseTrait(key: TraitKey, value: string) {
    const nextTraits = { ...traits, [key]: value as Traits[TraitKey] };
    setTraits(nextTraits);
    setPreviewId(null);
    setError(null);
    const index = TRAIT_GROUPS.findIndex((group) => group.key === key);
    if (index >= 0 && index < TRAIT_GROUPS.length - 1) setStep(index + 1);
    else setStep(TRAIT_GROUPS.length);
  }

  function addPhotos(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    const next = [...photos];
    for (const file of incoming) {
      if (next.length >= MAX_CLONE_PHOTOS) break;
      if (!file.type.startsWith("image/")) {
        setError("Formats acceptés : JPEG, PNG, WebP.");
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setError("Chaque photo doit faire moins de 4 Mo.");
        continue;
      }
      next.push({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
      });
    }
    setPhotos(next);
    setError(null);
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return current.filter((item) => item.id !== id);
    });
    if (referenceId === id) setReferenceId(null);
  }

  async function generateFrom(next: Traits) {
    setStatus("generating");
    setError(null);
    try {
      const response = await fetch("/api/previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traits: next }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        setError(payload.error ?? "Le visage n'a pas pu être généré. Réessaie.");
        return;
      }
      setPreviewId(payload.id);
    } catch {
      setError("Le visage n'a pas pu être généré. Réessaie.");
    } finally {
      setStatus("idle");
    }
  }

  function generateFace() {
    if (!completeTraits) {
      setError("Choisis chaque trait, puis revois le visage.");
      return;
    }
    void generateFrom(completeTraits);
  }

  async function saveBuilder() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
      setError("Donne un nom entre 2 et 40 caractères.");
      return;
    }
    if (!previewId) {
      setError("Génère un visage avant de l'enregistrer.");
      return;
    }
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, previewId }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        setError(payload.error ?? "L'enregistrement a échoué.");
        setStatus("idle");
        return;
      }
      router.push(`/personnages/${payload.id}`);
    } catch {
      setError("L'enregistrement a échoué.");
      setStatus("idle");
    }
  }

  async function saveClone() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
      setError("Donne un nom entre 2 et 40 caractères.");
      return;
    }
    if (photos.length < MIN_CLONE_PHOTOS || photos.length > MAX_CLONE_PHOTOS) {
      setError(`Il faut entre ${MIN_CLONE_PHOTOS} et ${MAX_CLONE_PHOTOS} photos.`);
      return;
    }
    if (!biometricConsent) {
      setError("Coche le consentement avant de cloner.");
      return;
    }
    const referenceIndex = photos.findIndex((photo) => photo.id === referenceId);
    if (referenceIndex < 0) {
      setError("Choisis la photo qui devient le visage.");
      return;
    }
    setStatus("saving");
    setError(null);

    try {
      const signed = await fetch("/api/characters/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentTypes: photos.map((photo) => photo.file.type || "image/jpeg"),
        }),
      });
      const signedPayload = (await signed.json()) as {
        uploads?: { key: string; url: string }[];
        error?: string;
        code?: string;
      };

      if (signed.ok && signedPayload.uploads) {
        await Promise.all(
          signedPayload.uploads.map(async (upload, index) => {
            const file = photos[index]?.file;
            if (!file) throw new Error("photo manquante");
            const put = await fetch(upload.url, {
              method: "PUT",
              headers: { "Content-Type": file.type || "image/jpeg" },
              body: file,
            });
            if (!put.ok) throw new Error("upload échoué");
          }),
        );
        const response = await fetch("/api/characters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            referenceIndex,
            uploadKeys: signedPayload.uploads.map((upload) => upload.key),
            biometricConsent: true,
          }),
        });
        const payload = (await response.json()) as { id?: string; error?: string };
        if (!response.ok || !payload.id) {
          setError(payload.error ?? "L'enregistrement a échoué.");
          setStatus("idle");
          return;
        }
        for (const photo of photos) URL.revokeObjectURL(photo.url);
        router.push(`/personnages/${payload.id}`);
        return;
      }

      if (signedPayload.code !== "driver_fs" && !signed.ok) {
        setError(signedPayload.error ?? "L'enregistrement a échoué.");
        setStatus("idle");
        return;
      }

      const form = new FormData();
      form.set("name", trimmed);
      form.set("referenceIndex", String(referenceIndex));
      form.set("biometricConsent", "true");
      for (const photo of photos) form.append("photos", photo.file);
      const response = await fetch("/api/characters", { method: "POST", body: form });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        setError(payload.error ?? "L'enregistrement a échoué.");
        setStatus("idle");
        return;
      }
      for (const photo of photos) URL.revokeObjectURL(photo.url);
      router.push(`/personnages/${payload.id}`);
    } catch {
      setError("L'enregistrement a échoué.");
      setStatus("idle");
    }
  }

  const stageImage =
    door === "builder"
      ? previewId
        ? `/api/previews/${previewId}`
        : null
      : reference?.url ?? null;

  const previewReady = door === "builder" && Boolean(previewId);
  const cloneReady =
    door === "clone" &&
    photos.length >= MIN_CLONE_PHOTOS &&
    Boolean(referenceId) &&
    biometricConsent;

  const builderSteps = TRAIT_GROUPS.length + 1;
  const cloneSteps = 3;
  const stepCount = door === "builder" ? builderSteps : cloneSteps;
  const safeStep = Math.min(step, stepCount - 1);

  return (
    <main className="grid min-h-[100dvh] md:grid-cols-[24rem_minmax(0,1fr)]">
      <p className="sr-only" aria-live="polite">
        {status === "generating" ? "Le visage se forme…" : status === "saving" ? "On le garde…" : ""}
      </p>

      <section className="flex flex-col bg-panel px-5 py-6 md:border-r md:border-line md:px-6 md:py-8">
        <Link
          href="/"
          className="shift ring-focus inline-flex items-center gap-2 self-start rounded-md text-sm text-mute hover:text-ink"
        >
          <IconArrowLeft size={16} />
          Influenceuses
        </Link>

        <div
          className="mt-8 grid grid-cols-2 gap-px border border-line bg-line"
          role="tablist"
          aria-label="Façon de créer le visage"
        >
          {(["builder", "clone"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={door === item}
              onClick={() => selectDoor(item)}
              className={`shift ring-focus telemetry py-2.5 text-[0.6875rem] ${
                door === item ? "bg-lime text-stage" : "bg-panel text-mute hover:bg-raise hover:text-ink"
              }`}
            >
              {doorTitle(item)}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${door}-${safeStep}`}
            className="mt-10 flex flex-1 flex-col"
            initial="hidden"
            animate="show"
            exit="hidden"
            variants={stepVariants}
          >
          <div className="flex items-center gap-3">
            <div className="flex flex-1 gap-1" aria-hidden="true">
              {Array.from({ length: stepCount }, (_, index) => (
                <span
                  key={index}
                  className={`h-1 flex-1 rounded-none ${index <= safeStep ? "bg-lime" : "bg-white/10"}`}
                />
              ))}
            </div>
            <p className="tabular text-xs text-mute">
              {safeStep + 1} / {stepCount}
            </p>
          </div>
          <h1 className="font-display mt-6 text-3xl font-bold tracking-[-0.03em] uppercase md:text-4xl">
            {door === "builder"
              ? safeStep < TRAIT_GROUPS.length
                ? TRAIT_GROUPS[safeStep].label
                : "Nom"
              : safeStep === 0
                ? "Photos"
                : safeStep === 1
                  ? "Visage"
                  : "Nom"}
          </h1>
          {door === "builder" && safeStep < TRAIT_GROUPS.length ? (
            <div
              role="radiogroup"
              aria-label={TRAIT_GROUPS[safeStep].label}
              className="mt-6 flex flex-col gap-1"
            >
              {TRAIT_GROUPS[safeStep].options.map((option) => {
                const group = TRAIT_GROUPS[safeStep];
                const selected = traits[group.key] === option.id;
                const noneSelected = traits[group.key] === undefined;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected || (noneSelected && option === group.options[0]) ? 0 : -1}
                    onClick={() => chooseTrait(group.key, option.id)}
                    onKeyDown={(event) =>
                      moveOption(event, group.options, traits[group.key], (id) =>
                        chooseTrait(group.key, id),
                      )
                    }
                    className={`shift ring-focus flex items-center justify-between gap-3 rounded-sm px-3.5 py-2.5 text-left text-base ${
                      selected ? "bg-lime-soft text-lime" : "text-ink hover:bg-white/5"
                    }`}
                  >
                    {option.label}
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded-none border ${
                        selected ? "border-lime bg-lime text-stage" : "border-white/15"
                      }`}
                    >
                      {selected ? <IconCheck size={12} strokeWidth={2.4} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {door === "builder" && safeStep === TRAIT_GROUPS.length ? (
            <div className="flex flex-col items-start">
              <label htmlFor="character-name" className="text-sm text-mute">
                Nom
              </label>
              <input
                id="character-name"
                name="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                placeholder="Mia"
                autoComplete="off"
                spellCheck={false}
                className="field mt-2"
              />
              <button
                type="button"
                onClick={generateFace}
                disabled={busy}
                className="btn btn-primary ring-focus mt-6"
              >
                {status === "generating" ? "Le visage se forme…" : previewId ? "Revoir" : "Voir l’influenceuse"}
              </button>
              {previewReady ? (
                <button
                  type="button"
                  onClick={saveBuilder}
                  disabled={busy}
                  className="btn btn-ghost ring-focus mt-3"
                >
                  {status === "saving" ? "On le garde…" : "Garder ce visage"}
                </button>
              ) : null}
            </div>
          ) : null}

          {door === "clone" && safeStep === 0 ? (
            <div className="flex flex-col items-start">
              <p className="max-w-[28ch] text-sm text-pretty text-mute">
                {MIN_CLONE_PHOTOS} à {MAX_CLONE_PHOTOS} photos. Uniquement toi, ou une personne d’accord.
              </p>
              <label className="btn btn-primary ring-focus mt-5 cursor-pointer">
                <IconPlus size={18} />
                Ajouter des photos
                <input
                  type="file"
                  name="photos"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    addPhotos(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
              <p className="mt-3 text-sm text-mute tabular-nums">
                {photos.length} sur {MAX_CLONE_PHOTOS}
              </p>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={photos.length < MIN_CLONE_PHOTOS}
                className="btn btn-ghost ring-focus mt-6"
              >
                Continuer
              </button>
            </div>
          ) : null}

          {door === "clone" && safeStep === 1 ? (
            <div>
            <ul className="mt-6 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Visage choisi">
              {photos.map((photo) => {
                const selected = photo.id === referenceId;
                return (
                  <li key={photo.id} className="relative">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setReferenceId(photo.id)}
                      className={`ring-focus block w-full overflow-hidden rounded-sm ${selected ? "ring-2 ring-lime ring-offset-2 ring-offset-panel" : ""}`}
                    >
                      <img src={photo.url} alt="" width={160} height={214} className="aspect-[3/4] w-full object-cover" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      className="ring-focus absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-sm bg-stage/90 text-ink"
                      aria-label="Retirer la photo"
                    >
                      <IconClose size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!referenceId}
              className="btn btn-ghost ring-focus mt-6"
            >
              Continuer
            </button>
            </div>
          ) : null}

          {door === "clone" && safeStep === 2 ? (
            <div className="flex flex-col items-start">
              <label htmlFor="character-name" className="text-sm text-mute">
                Nom
              </label>
              <input
                id="character-name"
                name="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                placeholder="Mia"
                autoComplete="off"
                spellCheck={false}
                className="field mt-2"
              />
              <label className="mt-5 flex max-w-[36ch] items-start gap-3 text-sm text-pretty text-mute">
                <input
                  type="checkbox"
                  checked={biometricConsent}
                  onChange={(event) => setBiometricConsent(event.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-lime"
                />
                <span>
                  J’ai le droit d’utiliser ces photos (moi ou consentement explicite). Les données
                  faciales serviront uniquement à verrouiller l’identité dans Ofmia.
                </span>
              </label>
              {cloneReady ? (
                <button
                  type="button"
                  onClick={saveClone}
                  disabled={busy}
                  className="btn btn-primary ring-focus mt-6"
                >
                  {status === "saving" ? "On le garde…" : "Garder ce visage"}
                </button>
              ) : (
                <p className="mt-4 text-sm text-mute">
                  Choisis le visage, le nom, et coche le consentement.
                </p>
              )}
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 text-sm text-pretty text-mute" role="alert">
              {error}
            </p>
          ) : null}

          {safeStep > 0 ? (
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              className="shift ring-focus mt-auto inline-flex items-center gap-2 self-start rounded-md pt-8 text-sm text-mute hover:text-ink"
            >
              <IconArrowLeft size={16} />
              Retour
            </button>
          ) : null}
          </motion.div>
        </AnimatePresence>
      </section>

      <section className="stage-glow flex items-center justify-center px-6 py-10">
        {stageImage ? (
          <FaceIn motionKey={stageImage} className="bezel max-h-[82vh] w-auto max-w-md shadow-stage">
            <div className="bezel-core">
              <img
                src={stageImage}
                alt={door === "builder" ? "Aperçu de l’influenceuse" : "Visage choisi"}
                width={768}
                height={1024}
                className="aspect-[3/4] max-h-[calc(82vh-0.7rem)] w-auto object-cover"
              />
            </div>
          </FaceIn>
        ) : (
          <div className="flex aspect-[3/4] max-h-[82vh] w-full max-w-sm flex-col items-center justify-center gap-4 rounded-none border border-dashed border-white/10 p-6 text-center">
            <span
              className={`flex size-12 items-center justify-center rounded-sm bg-raise text-dim ${status === "generating" ? "pulse-soft" : ""}`}
            >
              <IconImage size={22} />
            </span>
            <p className="max-w-[22ch] text-sm text-pretty text-mute">
              {status === "generating"
                ? "Le visage se forme…"
                : "L’influenceuse apparaît ici, une fois les traits choisis."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
