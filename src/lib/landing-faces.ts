export type LandingFace = {
  src: string;
  alt: string;
  label: string;
};

export const LUNA_LOCK: LandingFace = {
  src: "/landing/influencers/luna.jpg",
  alt: "Luna, visage verrouillé en studio",
  label: "Visage verrouillé",
};

export const LUNA_SCENES: readonly LandingFace[] = [
  LUNA_LOCK,
  {
    src: "/landing/showcase/luna-cafe.jpg",
    alt: "Luna au café, même visage",
    label: "Café",
  },
  {
    src: "/landing/showcase/luna-gym.jpg",
    alt: "Luna à la salle, même visage",
    label: "Sport",
  },
  {
    src: "/landing/showcase/luna-mirror.jpg",
    alt: "Luna en miroir, même visage",
    label: "Miroir",
  },
];

export const AMANI_LOCK: LandingFace = {
  src: "/landing/influencers/amani.jpg",
  alt: "Amani, visage verrouillé en studio",
  label: "Amani",
};

export const AMANI_SCENES = {
  restaurant: {
    src: "/landing/showcase/amani-restaurant.jpg",
    alt: "Amani au restaurant, même visage",
    label: "Soir",
  },
  shopping: {
    src: "/landing/showcase/amani-shopping.jpg",
    alt: "Amani en ville, même visage",
    label: "Rue",
  },
} as const;

export const FORMAT_FACES: Record<string, LandingFace> = {
  pov: LUNA_LOCK,
  grwm: LUNA_SCENES[3]!,
  journee: LUNA_SCENES[1]!,
  confession: AMANI_LOCK,
  "avant-apres": LUNA_SCENES[2]!,
};

export const AUDIENCE_FACES: readonly LandingFace[] = [
  AMANI_SCENES.restaurant,
  LUNA_SCENES[3]!,
  AMANI_SCENES.shopping,
];
