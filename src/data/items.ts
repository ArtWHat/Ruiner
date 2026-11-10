/** Ключи Steam CDN (не всегда совпадают с purchase_log). */
const ICON_ALIAS: Record<string, string> = {
  battle_fury: 'bfury',
  bfury: 'bfury',
  manta: 'manta',
  travel_boots: 'travel_boots',
  travel_boots_2: 'travel_boots_2',
  ultimate_scepter: 'ultimate_scepter',
  ultimate_scepter_2: 'ultimate_scepter_2',
  aghanims_shard: 'aghanims_shard',
  sheepstick: 'sheepstick',
  blink: 'blink',
  ethereal_blade: 'ethereal_blade',
  rod_of_atos: 'rod_of_atos',
  occult_bracelet: 'occult_bracelet',
  wizard_hat: 'wizard_hat',
}

const SKIP = new Set([
  'tpscroll',
  'ward_observer',
  'ward_sentry',
  'tome_of_knowledge',
  'clarity',
  'flask',
  'tango',
  'tango_single',
  'dust',
  'smoke_of_deceit',
  'enchanted_mango',
  'faerie_fire',
  'blood_grenade',
  'branches',
  'circlet',
  'gauntlets',
  'slippers',
  'mantle',
  'belt_of_strength',
  'boots_of_elves',
  'robe',
  'gloves',
  'blades_of_attack',
  'chainmail',
  'quarterstaff',
  'helm_of_iron_will',
  'broadsword',
  'claymore',
  'javelin',
  'mithril_hammer',
  'ring_of_protection',
  'stout_shield',
  'quelling_blade',
  'infused_raindrop',
  'blight_stone',
  'orb_of_venom',
  'orb_of_corrosion',
  'wind_lace',
  'ring_of_regen',
  'sobi_mask',
  'ring_of_basilius',
  'buckler',
  'headdress',
  'crown',
  'staff_of_wizardry',
  'ogre_axe',
  'blade_of_alacrity',
  'point_booster',
  'vitality_booster',
  'energy_booster',
  'platemail',
  'hyperstone',
  'eagle',
  'reaver',
  'mystic_staff',
  'demon_edge',
  'relic',
  'void_stone',
  'lifesteal',
  'shadow_amulet',
  'ghost',
  'cloak',
  'null_talisman',
  'wraith_band',
  'bracer',
  'magic_stick',
  'boots',
  'blitz_knuckles',
  'fluffy_hat',
  'ring_of_health',
  'sage_mask',
])

export function itemIconKey(key: string): string {
  return ICON_ALIAS[key] ?? key
}

export function itemIconUrl(key: string): string {
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${itemIconKey(key)}.png`
}

export function isMajorItem(key: string): boolean {
  if (SKIP.has(key)) return false
  if (key.startsWith('recipe_')) return false
  return true
}

export const ITEM_LABELS: Record<string, string> = {
  power_treads: 'Power Treads',
  phase_boots: 'Phase Boots',
  arcane_boots: 'Arcane Boots',
  tranquil_boots: 'Tranquil Boots',
  travel_boots: 'Boots of Travel',
  bfury: 'Battle Fury',
  battle_fury: 'Battle Fury',
  manta: 'Manta Style',
  black_king_bar: 'Black King Bar',
  bottle: 'Bottle',
  blink: 'Blink Dagger',
  soul_ring: 'Soul Ring',
  blade_mail: 'Blade Mail',
  crimson_guard: 'Crimson Guard',
  force_staff: 'Force Staff',
  glimmer_cape: 'Glimmer Cape',
  aether_lens: 'Aether Lens',
  magic_wand: 'Magic Wand',
  ghost: 'Ghost Scepter',
  aghanims_shard: "Aghanim's Shard",
  ultimate_scepter: "Aghanim's Scepter",
  sheepstick: 'Scythe of Vyse',
  butterfly: 'Butterfly',
  abyssal_blade: 'Abyssal Blade',
  satanic: 'Satanic',
  desolator: 'Desolator',
  orchid: 'Orchid Malevolence',
  maelstrom: 'Maelstrom',
  mjollnir: 'Mjollnir',
  diffusal_blade: 'Diffusal Blade',
  dragon_lance: 'Dragon Lance',
  hurricane_pike: 'Hurricane Pike',
  ethereal_blade: 'Ethereal Blade',
  rod_of_atos: 'Rod of Atos',
  veil_of_discord: 'Veil of Discord',
  spirit_vessel: 'Spirit Vessel',
  urn_of_shadows: 'Urn of Shadows',
  solar_crest: 'Solar Crest',
  medallion_of_courage: 'Medallion',
  pipe: 'Pipe of Insight',
  boots: 'Boots',
  radiance: 'Radiance',
  monkey_king_bar: 'Monkey King Bar',
  lotus_orb: 'Lotus Orb',
  silver_edge: 'Silver Edge',
  shivas_guard: "Shiva's Guard",
  heart: 'Heart of Tarrasque',
  bloodthorn: 'Bloodthorn',
  null_talisman: 'Null Talisman',
}

export function itemLabel(key: string): string {
  return ITEM_LABELS[key] ?? key.replace(/_/g, ' ')
}

/** Типичные сборки по hero_id (укороченные ориентиры). */
export const HERO_ITEM_TARGETS: Record<
  number,
  Array<{ key: string; minute: number }>
> = {
  // Mirana
  9: [
    { key: 'magic_wand', minute: 5 },
    { key: 'arcane_boots', minute: 12 },
    { key: 'force_staff', minute: 20 },
    { key: 'aghanims_shard', minute: 22 },
    { key: 'solar_crest', minute: 28 },
  ],
  // Phantom Assassin
  44: [
    { key: 'power_treads', minute: 8 },
    { key: 'bfury', minute: 16 },
    { key: 'desolator', minute: 22 },
    { key: 'black_king_bar', minute: 28 },
  ],
  // Phoenix
  110: [
    { key: 'tranquil_boots', minute: 8 },
    { key: 'urn_of_shadows', minute: 12 },
    { key: 'spirit_vessel', minute: 18 },
    { key: 'shivas_guard', minute: 28 },
  ],
  // Skywrath
  101: [
    { key: 'null_talisman', minute: 3 },
    { key: 'arcane_boots', minute: 10 },
    { key: 'rod_of_atos', minute: 16 },
    { key: 'aether_lens', minute: 20 },
    { key: 'sheepstick', minute: 30 },
  ],
  // Lion
  26: [
    { key: 'tranquil_boots', minute: 8 },
    { key: 'blink', minute: 14 },
    { key: 'aether_lens', minute: 20 },
    { key: 'force_staff', minute: 26 },
  ],
}
