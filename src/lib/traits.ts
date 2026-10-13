export const TRAIT_GROUPS = [
  {
    key: "gender",
    label: "Genre",
    options: [
      { id: "femme", label: "Femme", prompt: "woman" },
      { id: "homme", label: "Homme", prompt: "man" },
    ],
  },
  {
    key: "age",
    label: "Âge",
    options: [
      { id: "18-24", label: "18–24", prompt: "adult in their early twenties" },
      { id: "25-34", label: "25–34", prompt: "adult in their early thirties" },
      { id: "35-44", label: "35–44", prompt: "adult in their early forties" },
      { id: "45-54", label: "45–54", prompt: "adult in their early fifties" },
    ],
  },
  {
    key: "eyes",
    label: "Yeux",
    options: [
      { id: "marron", label: "Marron", prompt: "brown" },
      { id: "noisette", label: "Noisette", prompt: "hazel" },
      { id: "vert", label: "Vert", prompt: "green" },
      { id: "bleu", label: "Bleu", prompt: "blue" },
      { id: "gris", label: "Gris", prompt: "gray" },
    ],
  },
  {
    key: "hairLength",
    label: "Cheveux",
    options: [
      { id: "court", label: "Courts", prompt: "short" },
      { id: "mi-long", label: "Mi-longs", prompt: "shoulder-length" },
      { id: "long", label: "Longs", prompt: "long" },
    ],
  },
  {
    key: "hairColor",
    label: "Couleur",
    options: [
      { id: "noir", label: "Noirs", prompt: "black" },
      { id: "chatain", label: "Châtains", prompt: "brown" },
      { id: "blond", label: "Blonds", prompt: "blonde" },
      { id: "roux", label: "Roux", prompt: "red" },
      { id: "gris", label: "Gris", prompt: "gray" },
    ],
  },
  {
    key: "body",
    label: "Corps",
    options: [
      { id: "mince", label: "Mince", prompt: "slim build" },
      { id: "athletique", label: "Athlétique", prompt: "athletic build" },
      { id: "moyen", label: "Moyen", prompt: "average build" },
      { id: "pulpeux", label: "Pulpeux", prompt: "curvy build" },
    ],
  },
  {
    key: "skin",
    label: "Peau",
    options: [
      { id: "claire", label: "Claire", prompt: "fair" },
      { id: "mate", label: "Mate", prompt: "light olive" },
      { id: "olive", label: "Olive", prompt: "olive" },
      { id: "foncee", label: "Foncée", prompt: "deep brown" },
      { id: "profonde", label: "Profonde", prompt: "deep ebony" },
    ],
  },
] as const;

export type TraitKey = (typeof TRAIT_GROUPS)[number]["key"];

export type Traits = {
  [K in TraitKey]: Extract<(typeof TRAIT_GROUPS)[number], { key: K }>["options"][number]["id"];
};

export const MIN_CLONE_PHOTOS = 7;
export const MAX_CLONE_PHOTOS = 15;
export const MIN_LORA_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export function parseTraits(input: unknown): Traits | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (Object.keys(record).length !== TRAIT_GROUPS.length) return null;

  const draft: Record<string, string> = {};
  for (const group of TRAIT_GROUPS) {
    const value = record[group.key];
    if (typeof value !== "string") return null;
    if (!group.options.some((option) => option.id === value)) return null;
    draft[group.key] = value;
  }

  return draft as Traits;
}

export function promptFragment(key: TraitKey, id: string): string | null {
  const group = TRAIT_GROUPS.find((item) => item.key === key);
  const option = group?.options.find((item) => item.id === id);
  return option?.prompt ?? null;
}

export function traitLabel(key: TraitKey, id: string): string {
  const group = TRAIT_GROUPS.find((item) => item.key === key);
  const option = group?.options.find((item) => item.id === id);
  return option?.label ?? id;
}

export function buildFacePrompt(traits: Traits): string {
  const gender = promptFragment("gender", traits.gender);
  const age = promptFragment("age", traits.age);
  const eyes = promptFragment("eyes", traits.eyes);
  const hairLength = promptFragment("hairLength", traits.hairLength);
  const hairColor = promptFragment("hairColor", traits.hairColor);
  const body = promptFragment("body", traits.body);
  const skin = promptFragment("skin", traits.skin);

  if (!gender || !age || !eyes || !hairLength || !hairColor || !body || !skin) {
    throw new Error("traits incomplets");
  }

  return [
    `Photorealistic close portrait of one ${age} ${gender},`,
    `${skin} skin, ${eyes} eyes, ${hairLength} ${hairColor} hair, ${body}.`,
    "Facing the camera, calm expression, natural skin texture with visible pores,",
    "soft window light, shallow depth of field, sharp eyes, plain warm gray background.",
    "Head and shoulders, clothed, no text, no watermark, no logo.",
    "An ordinary person, not a celebrity.",
  ].join(" ");
}
