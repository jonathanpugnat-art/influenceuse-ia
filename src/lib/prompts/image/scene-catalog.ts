import type { GenderedTemplate } from "./types";

/** Templates per scene — casual real-life locations */
export const SCENE_TEMPLATES: Record<string, string> = {
  studio: "simple room with white walls, natural window light, full length mirror, casual home setting",
  beach: "real beach, natural daylight, sand and ocean, beach towel and sunscreen nearby, other beachgoers in distance, slightly overexposed from sun",
  urban: "real city sidewalk, shops and pedestrians in background, crosswalk, parked cars, natural street lighting, slightly busy",
  gym: "regular gym with other people working out, fluorescent overhead lighting, rubber floor, dumbbells and machines, gym mirror, water bottle",
  bedroom: "real bedroom, unmade bed, phone charger on nightstand, normal room lighting, laundry basket in corner, everyday life",
  restaurant: "normal restaurant table with real food and drinks, other diners visible, overhead restaurant lighting, menu on table, napkins",
  nature: "park or hiking trail, trees and grass, natural daylight, other hikers in distance, dirt path, wildflowers",
  cafe: "real coffee shop, ordering counter in background, paper coffee cup on table, laptop or phone visible, other customers, overhead lights",
  rooftop: "apartment rooftop or balcony, city buildings in background, plastic chairs, drinks on table, sunset, urban view",
  pool: "normal pool area, concrete deck, pool towels on loungers, sunscreen bottle, other swimmers, bright midday sun, pool noodles",
};

/**
 * Short English scene descriptions for the photo UI — filled into the
 * user's textarea, not injected as hidden SCENE_TEMPLATES. Edit freely in-app.
 */
export const SCENE_INSPIRATIONS: Record<string, string> = {
  studio:
    "cozy corner at home, soft natural light from a window, everyday decor, casual indoor vibe",
  beach:
    "real beach in daylight, sand and ocean behind, casual beach day, natural sun on skin",
  urban:
    "on a real city sidewalk, shops and pedestrians in the background, outdoor street photo, no mirror",
  gym:
    "inside a normal gym, gym mirror on the wall for a workout selfie, other people training, fluorescent lights",
  bedroom:
    "real bedroom, unmade bed, cozy morning light, phone charger on nightstand, everyday life",
  restaurant:
    "restaurant table with real food and drinks, other diners softly visible, warm indoor lighting",
  nature:
    "park or hiking trail, trees and grass, natural daylight, casual outdoor walk",
  cafe:
    "coffee shop interior, iced latte on the table, laptop nearby, other customers in background",
  rooftop:
    "apartment rooftop at sunset, city skyline behind, drinks on a small table, casual evening",
  pool:
    "pool deck in bright midday sun, loungers and towels, relaxed summer pool day",
};

export function getSceneInspirationText(presetId: string): string {
  return SCENE_INSPIRATIONS[presetId] ?? "";
}

/** Scene-specific accessories — gendered for realism (no cross-gender accessories) */
export const SCENE_ACCESSORIES: Record<string, GenderedTemplate> = {
  studio: {
    female: "ring light, phone tripod, makeup palette on table",
    male: "ring light, phone tripod, plain backdrop, grooming products, minimalist watch",
    nonbinary: "ring light, phone tripod, minimalist props",
  },
  beach: {
    female: "oversized sunglasses on head, straw tote bag, iced drink with straw, beach magazine, anklet jewelry",
    male: "aviator sunglasses, surf shorts, beach towel, cold drink, baseball cap, surfboard nearby",
    nonbinary: "sunglasses, tote bag, iced drink, beach towel",
  },
  urban: {
    female: "designer sunglasses, crossbody bag, iced coffee, AirPods, layered gold necklaces, scrunchie on wrist",
    male: "designer sunglasses, leather backpack, iced coffee, AirPods, silver chain necklace, chunky watch",
    nonbinary: "sunglasses, crossbody bag, iced coffee, AirPods, minimalist jewelry",
  },
  gym: {
    female: "wireless earbuds, fitness tracker watch, shaker bottle, resistance bands, hair tied in messy bun with scrunchie",
    male: "wireless earbuds, fitness tracker watch, shaker bottle, lifting straps, gym towel on shoulder, baseball cap backwards",
    nonbinary: "wireless earbuds, fitness tracker, shaker bottle, gym towel",
  },
  bedroom: {
    female: "silk pajamas, messy bun with claw clip, coffee mug, phone with cute case, fuzzy slippers, skincare products on nightstand",
    male: "plain t-shirt and shorts, bedhead hair, coffee mug, phone on nightstand, basic slippers, watch and wallet on nightstand",
    nonbinary: "comfy pajamas, messy hair, coffee mug, cozy slippers",
  },
  restaurant: {
    female: "wine glass, clutch purse, statement earrings, candlelight reflecting on jewelry, dessert plate",
    male: "whiskey glass, leather wallet on table, chunky watch, rolled up sleeves, candlelight, dessert plate",
    nonbinary: "wine glass, minimalist bag, subtle jewelry, candlelight",
  },
  nature: {
    female: "hiking backpack, baseball cap, water bottle, trail running shoes, friendship bracelets",
    male: "hiking backpack, baseball cap, water bottle, trail running shoes, trekking poles, multi-tool on belt",
    nonbinary: "hiking backpack, baseball cap, water bottle, trail shoes",
  },
  cafe: {
    female: "iced oat milk latte, MacBook or iPad, tote bag on chair, reading glasses pushed up on head, pastry on plate",
    male: "black coffee or espresso, MacBook, leather messenger bag, notebook and pen, pastry on plate",
    nonbinary: "iced latte, MacBook, tote bag, pastry, notebook",
  },
  rooftop: {
    female: "cocktail glass, oversized blazer draped on shoulders, clutch purse, statement heels, city lights reflecting in sunglasses",
    male: "cocktail or craft beer, blazer, leather oxfords, luxury watch, cigar optional, city lights",
    nonbinary: "cocktail glass, blazer draped on shoulders, minimal accessories",
  },
  pool: {
    female: "oversized sunglasses, straw sun hat, tropical cocktail with umbrella, pool float, gold body chain",
    male: "aviator sunglasses, swim shorts, cold beer or cocktail, water bottle, sports watch, pool float",
    nonbinary: "sunglasses, sun hat, tropical drink, pool float",
  },
};
