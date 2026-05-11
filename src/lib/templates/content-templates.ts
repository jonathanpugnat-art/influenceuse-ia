export interface ContentTemplate {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  emoji: string;
  niches: string[];
  params: {
    scene: string;
    pose: string;
    expression: string;
    photoStyle: string;
    timeOfDay: string;
    outfitFemale: string;
    outfitMale: string;
    location?: string;
  };
}

export const CONTENT_TEMPLATES: ContentTemplate[] = [
  {
    id: "mirror-selfie-gym",
    name: "Mirror selfie gym",
    nameEn: "Gym mirror selfie",
    description: "Selfie miroir à la salle de sport, vibes post-workout",
    descriptionEn: "Gym mirror selfie, post-workout vibes",
    emoji: "💪",
    niches: ["FITNESS", "LIFESTYLE"],
    params: {
      scene: "gym",
      pose: "selfie",
      expression: "natural",
      photoStyle: "natural",
      timeOfDay: "natural",
      outfitFemale: "legging noir et brassière sport",
      outfitMale: "short de sport et débardeur",
    },
  },
  {
    id: "cafe-aesthetic",
    name: "Café aesthetic",
    nameEn: "Aesthetic café",
    description: "Matin café avec MacBook, ambiance cozy",
    descriptionEn: "Morning coffee with MacBook, cozy vibes",
    emoji: "☕",
    niches: ["LIFESTYLE", "FASHION", "TRAVEL"],
    params: {
      scene: "cafe",
      pose: "sitting",
      expression: "natural",
      photoStyle: "editorial",
      timeOfDay: "golden_hour",
      outfitFemale: "pull oversized beige et jean",
      outfitMale: "hoodie et jean casual",
    },
  },
  {
    id: "beach-vibes",
    name: "Beach vibes",
    nameEn: "Beach vibes",
    description: "Journée plage, soleil et mer",
    descriptionEn: "Beach day, sun and sea",
    emoji: "🏖️",
    niches: ["TRAVEL", "LIFESTYLE", "FASHION"],
    params: {
      scene: "beach",
      pose: "candid",
      expression: "laughing",
      photoStyle: "natural",
      timeOfDay: "golden_hour",
      outfitFemale: "robe de plage fluide",
      outfitMale: "short de bain et t-shirt blanc",
    },
  },
  {
    id: "airport-ootd",
    name: "Airport OOTD",
    nameEn: "Airport OOTD",
    description: "Look d'aéroport avec valise",
    descriptionEn: "Airport outfit with luggage",
    emoji: "✈️",
    niches: ["TRAVEL", "FASHION", "LIFESTYLE"],
    params: {
      scene: "urban",
      pose: "fullBody",
      expression: "natural",
      photoStyle: "street_style",
      timeOfDay: "natural",
      outfitFemale: "ensemble confort beige et baskets",
      outfitMale: "jogging tech et hoodie",
      location: "airport terminal",
    },
  },
  {
    id: "rooftop-sunset",
    name: "Rooftop sunset",
    nameEn: "Rooftop sunset",
    description: "Coucher de soleil sur rooftop, cocktail en main",
    descriptionEn: "Rooftop sunset with cocktail",
    emoji: "🌆",
    niches: ["LIFESTYLE", "FASHION"],
    params: {
      scene: "rooftop",
      pose: "profile",
      expression: "mysterious",
      photoStyle: "cinematic",
      timeOfDay: "golden_hour",
      outfitFemale: "robe de soirée chic",
      outfitMale: "chemise ouverte et pantalon habillé",
    },
  },
  {
    id: "restaurant-chic",
    name: "Dîner chic",
    nameEn: "Chic dinner",
    description: "Dîner aux chandelles, ambiance tamisée",
    descriptionEn: "Candlelit dinner",
    emoji: "🍽️",
    niches: ["LIFESTYLE", "FOOD", "FASHION"],
    params: {
      scene: "restaurant",
      pose: "sitting",
      expression: "seductive",
      photoStyle: "cinematic",
      timeOfDay: "neon",
      outfitFemale: "petite robe noire élégante",
      outfitMale: "chemise sombre et blazer",
    },
  },
  {
    id: "morning-routine",
    name: "Morning routine",
    nameEn: "Morning routine",
    description: "Réveil naturel, lumière du matin",
    descriptionEn: "Natural wake-up, morning light",
    emoji: "🛏️",
    niches: ["LIFESTYLE", "FASHION"],
    params: {
      scene: "bedroom",
      pose: "candid",
      expression: "natural",
      photoStyle: "natural",
      timeOfDay: "natural",
      outfitFemale: "pyjama en soie",
      outfitMale: "t-shirt blanc et short de pyjama",
    },
  },
  {
    id: "street-style",
    name: "Street style",
    nameEn: "Street style",
    description: "Look urbain, shooting en rue",
    descriptionEn: "Urban outfit, street shoot",
    emoji: "🏙️",
    niches: ["FASHION", "LIFESTYLE"],
    params: {
      scene: "urban",
      pose: "action",
      expression: "serious",
      photoStyle: "street_style",
      timeOfDay: "blue_hour",
      outfitFemale: "trench coat et bottes",
      outfitMale: "bomber et jean slim",
    },
  },
  {
    id: "paris-landmark",
    name: "Paris iconic",
    nameEn: "Paris iconic",
    description: "Shoot devant la Tour Eiffel",
    descriptionEn: "Shoot at Eiffel Tower",
    emoji: "🗼",
    niches: ["TRAVEL", "FASHION", "LIFESTYLE"],
    params: {
      scene: "urban",
      pose: "fullBody",
      expression: "smile",
      photoStyle: "travel",
      timeOfDay: "golden_hour",
      outfitFemale: "robe parisienne chic",
      outfitMale: "blazer marine et jean",
      location: "Eiffel Tower Paris France",
    },
  },
];
