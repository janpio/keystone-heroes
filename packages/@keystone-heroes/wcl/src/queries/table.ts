import { getCachedSdk } from "../client";

import type { TableQueryVariables } from "../types";
import type { PlayableClass, Role, SpecName } from "@prisma/client";

export const loadTableFromSource = async (
  params: TableQueryVariables
): Promise<Table | null> => {
  try {
    const sdk = await getCachedSdk();
    const json = await sdk.Table(params);

    return json?.reportData?.report?.table.data ?? null;
  } catch {
    return null;
  }
};

export type Table = {
  totalTime: number;
  itemLevel: number;
  logVersion: number;
  gameVersion: number;
  composition: Composition[];
  damageDone: DamageDone[];
  healingDone: HealingDone[];
  damageTaken: DamageTaken[];
  deathEvents: DeathEvent[];
  playerDetails: PlayerDetails;
};

type Composition = {
  name: string;
  id: number;
  guid: number;
  type: PlayableClass;
  specs: SpecMeta[];
};

type SpecMeta = {
  spec: string;
  role: Role;
};

export type DamageDone = Pick<Composition, "name" | "id" | "guid"> & {
  total: number;
  icon: string;
  type: Composition["type"] | "Pet" | "NPC";
};

export type HealingDone = DamageDone;

export type DamageTaken = Pick<DamageDone, "name" | "guid" | "total"> & {
  abilityIcon: string;
  type: number;
};

type DeathEvent = Pick<DamageDone, "name" | "id" | "guid" | "type" | "icon"> & {
  deathTime: number;
  ability: Omit<DamageTaken, "total">;
};

export type PlayerDetails = {
  tanks: InDepthCharacterInformation[];
  dps: InDepthCharacterInformation[];
  healers: InDepthCharacterInformation[];
};

export type InDepthCharacterInformation = {
  name: string;
  id: number;
  guid: number;
  type: PlayableClass;
  server: string;
  icon: string;
  specs: SpecName[];
  minItemLevel: number;
  maxItemLevel: number;
  combatantInfo: CombatantInfo;
};

type CombatantInfo = {
  stats: Stats;
  talents: Talent[];
  artifact: Artifact[];
  gear: (Item | LegendaryItem)[];
  heartOfAzeroth: HeartOfAzeroth[];
  specIDs: number[];
  factionID: number;
  covenantID?: number;
  soulbindID?: number;
};

type Stats = {
  Speed: Stat;
  Dodge: Stat;
  Mastery: Stat;
  Stamina: Stat;
  Haste: Stat;
  Leech: Stat;
  Armor: Stat;
  Agility: Stat;
  Crit: Stat;
  "Item Level": Stat;
  Parry: Stat;
  Avoidance: Stat;
  Versatility: Stat;
  Intellect: Stat;
};

type Stat = {
  min: number;
  max: number;
};

export type Talent = {
  name: string;
  guid: number;
  type: number;
  abilityIcon: string;
};

type Artifact = {
  name: string;
  guid: number;
  type: number;
  abilityIcon: string;
  total: number;
};

export enum ItemQuality {
  POOR = 1,
  COMMON = 2,
  RARE = 3,
  SUPERIOR = 4,
  LEGENDARY = 5,
}

export type Item = {
  id: number;
  slot: number;
  quality: ItemQuality;
  icon: string;
  name?: string;
  itemLevel: number;
  bonusIDs?: number[];
  gems?: Gem[];
  permanentEnchant?: number;
  permanentEnchantName?: string;
  onUseEnchant?: number;
  onUseEnchantName?: string;
  effectID?: number;
  effectIcon?: string;
  effectName?: string;
  temporaryEnchant?: number;
  temporaryEnchantName?: string;
};

export type LegendaryItem = Item & {
  quality: ItemQuality.LEGENDARY;
  effectID: number;
  effectIcon: string;
  effectName: string;
};

type Gem = {
  id: number;
  itemLevel: number;
  icon: string;
};

type HeartOfAzeroth = {
  name: string;
  guid: number;
  type: number;
  abilityIcon: string;
  total: number;
};

export type Conduit = Omit<HeartOfAzeroth, "type">;
export type SoulbindTalent = Omit<Artifact, "type" | "total">;
