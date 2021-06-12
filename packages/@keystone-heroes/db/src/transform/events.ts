import type {
  ApplyBuffEvent,
  ApplyBuffStackEvent,
  ApplyDebuffEvent,
  BeginCastEvent,
  CastEvent,
  DamageEvent,
  DeathEvent,
  HealEvent,
  InterruptEvent,
  RemoveBuffEvent,
  AnyEvent,
} from "@keystone-heroes/wcl/src/queries/events";
import type {
  ReportDungeonPullNpc,
  ReportMapBoundingBox,
} from "@keystone-heroes/wcl/types";
import type { DeepNonNullable } from "ts-essentials";

import {
  BOLSTERING,
  BURSTING,
  DOS_URN,
  EXPLOSIVE,
  GRIEVOUS_WOUND,
  NECROTIC,
  NW_KYRIAN_ORB_HEAL,
  PF_GREEN_BUFF,
  PF_PURPLE_BUFF,
  PF_RED_BUFF,
  QUAKING,
  SANGUINE_ICHOR_DAMAGE,
  SANGUINE_ICHOR_HEALING,
  SD_LANTERN_BUFF,
  SD_LANTERN_OPENING,
  SOA_SPEAR,
  STORMING,
  TOP_BANNER_AURA,
  VOLCANIC,
} from "../data";
import { EventType } from "../prisma";
import type { Prisma, Pull, PullZone } from "../prisma";

type Processor<T extends AnyEvent, AdditionalParams = Record<string, null>> = (
  event: T,
  params: {
    sourcePlayerID: number | null;
    targetPlayerID: number | null;
    sourceNPCID: number | null;
    targetNPCID: number | null;
  } & AdditionalParams
) => Prisma.EventCreateManyPullInput | null;

/**
 * track bolstering, ToP and PF buffs
 */
const applyBuffProcessor: Processor<ApplyBuffEvent & { stacks?: number }> = (
  event,
  { sourcePlayerID, targetPlayerID, targetNPCID }
) => {
  if (
    sourcePlayerID &&
    targetPlayerID &&
    (event.abilityGameID === TOP_BANNER_AURA ||
      event.abilityGameID === PF_GREEN_BUFF.aura ||
      event.abilityGameID === PF_RED_BUFF.aura ||
      event.abilityGameID === PF_PURPLE_BUFF.aura)
  ) {
    return {
      timestamp: event.timestamp,
      eventType: EventType.ApplyBuff,
      abilityID: event.abilityGameID,
      sourcePlayerID,
      targetPlayerID,
    };
  }

  if (event.abilityGameID === BOLSTERING && targetNPCID) {
    return {
      timestamp: event.timestamp,
      eventType: EventType.ApplyBuff,
      stacks: event.stacks ?? null,
      targetNPCID,
      targetNPCInstance: event.targetInstance ?? null,
    };
  }

  if (event.abilityGameID === SD_LANTERN_BUFF && targetPlayerID) {
    return {
      timestamp: event.timestamp,
      eventType: EventType.ApplyBuff,
      targetPlayerID,
      abilityID: event.abilityGameID,
    };
  }

  return null;
};

/**
 * track SD Lantern usage
 */
const applyBuffStackProcessor: Processor<ApplyBuffStackEvent> = (
  event,
  { targetPlayerID }
) => {
  if (targetPlayerID && event.abilityGameID === SD_LANTERN_BUFF) {
    return {
      timestamp: event.timestamp,
      eventType: EventType.ApplyBuffStack,
      abilityID: event.abilityGameID,
      targetPlayerID,
      stack: event.stack,
    };
  }

  return null;
};

/**
 * track SoA Spear & DOS Urn
 */
const applyDebuffProcessor: Processor<ApplyDebuffEvent> = (event) => {
  if (event.abilityGameID === SOA_SPEAR || event.abilityGameID === DOS_URN) {
    return {
      timestamp: event.timestamp,
      eventType: EventType.ApplyDebuff,
      abilityID: event.abilityGameID,
    };
  }

  return null;
};

/**
 * track SD Lantern usage
 */
const beginCastProcessor: Processor<BeginCastEvent> = (
  event,
  { sourcePlayerID }
) => {
  if (sourcePlayerID && event.abilityGameID === SD_LANTERN_OPENING) {
    return {
      timestamp: event.timestamp,
      eventType: EventType.BeginCast,
      abilityID: event.abilityGameID,
      sourcePlayerID,
    };
  }

  return null;
};

/**
 * track any cast from players
 * - pre-filtered to only contain 1min+ cooldowns
 * - dungeon-specific abilities (HoA Gargoyles)
 */
const castProcessor: Processor<CastEvent> = (
  event,
  { sourcePlayerID, targetNPCID, targetPlayerID }
) => {
  if (sourcePlayerID) {
    return {
      timestamp: event.timestamp,
      abilityID: event.abilityGameID,
      eventType: EventType.Cast,
      targetNPCID,
      targetPlayerID,
      sourcePlayerID,
    };
  }

  return null;
};

const isEnvironmentalDamageAffixAbilityID = (id: number) =>
  id === VOLCANIC ||
  id === STORMING ||
  id === EXPLOSIVE.ability ||
  id === GRIEVOUS_WOUND ||
  id === SANGUINE_ICHOR_DAMAGE ||
  id === BURSTING ||
  id === QUAKING ||
  id === NECROTIC;

/**
 * track any damage taken from
 * - affixes
 * - prideful in general
 *
 * track any player damage done to
 * - explosives (pre-filtered to only contain lasthits)
 * - prideful in general
 */
const damageProcessor: Processor<DamageEvent> = (
  event,
  { targetPlayerID, sourcePlayerID, sourceNPCID, targetNPCID }
) => {
  if (event.amount === 0) {
    return null;
  }

  // player taking damage
  if (targetPlayerID) {
    if (isEnvironmentalDamageAffixAbilityID(event.abilityGameID)) {
      return {
        timestamp: event.timestamp,
        abilityID: event.abilityGameID,
        eventType: EventType.DamageTaken,
        damage: event.amount + (event.absorbed ?? 0),
        targetPlayerID,
        sourcePlayerID,
      };
    }

    // NPC damaging player
    if (sourceNPCID) {
      return {
        timestamp: event.timestamp,
        eventType: EventType.DamageTaken,
        damage: event.amount + (event.absorbed ?? 0),
        targetPlayerID,
        sourceNPCID,
      };
    }
  }

  // Player damaging NPC
  if (targetNPCID && sourcePlayerID) {
    return {
      timestamp: event.timestamp,
      eventType: EventType.DamageDone,
      // damage vs Explosives is irrelevant
      damage:
        targetNPCID === EXPLOSIVE.unit
          ? null
          : event.amount + (event.absorbed ?? 0),
      targetNPCID,
      sourcePlayerID,
    };
  }

  return null;
};

/**
 * track deaths:
 * - all player deaths
 * - prideful deaths
 * - PF slimes
 */
const deathProcessor: Processor<DeathEvent, { pull: PersistedDungeonPull }> = (
  event,
  { targetNPCID, targetPlayerID, pull }
) => {
  const sourceNPCID =
    pull.enemyNPCs.find((npc) => npc.id === event.killerID)?.gameID ?? null;

  // player death
  if (targetPlayerID) {
    return {
      timestamp: event.timestamp,
      eventType: EventType.Death,
      sourceNPCInstance: event.killerInstance ?? null,
      targetPlayerID,
      sourceNPCID,
    };
  }

  // prideful, PF slimes
  return {
    timestamp: event.timestamp,
    eventType: EventType.Death,
    targetNPCInstance: event.targetInstance ?? null,
    targetNPCID,
  };
};

/**
 * track any heal:
 * - sanguine
 * - kyrian orb
 */
const healProcessor: Processor<HealEvent> = (
  event,
  { targetNPCID, targetPlayerID, sourcePlayerID }
) => {
  if (event.amount === 0) {
    return null;
  }

  if (
    event.abilityGameID === NW_KYRIAN_ORB_HEAL &&
    sourcePlayerID &&
    targetPlayerID
  ) {
    return {
      timestamp: event.timestamp,
      eventType: EventType.HealingDone,
      abilityID: NW_KYRIAN_ORB_HEAL,
      healingDone: event.amount,
      sourcePlayerID,
      targetPlayerID,
    };
  }

  if (event.abilityGameID === SANGUINE_ICHOR_HEALING && targetNPCID) {
    return {
      timestamp: event.timestamp,
      eventType: EventType.HealingDone,
      abilityID: SANGUINE_ICHOR_HEALING,
      healingDone: event.amount,
      targetNPCID,
    };
  }

  return null;
};

/**
 * track any interrupts through quaking including the interrupted ability
 */
const interruptProcessor: Processor<InterruptEvent> = (
  event,
  { sourcePlayerID, targetPlayerID }
) => {
  if (sourcePlayerID && targetPlayerID) {
    return {
      timestamp: event.timestamp,
      eventType: EventType.Interrupt,
      interruptedAbilityID: event.extraAbilityGameID,
      sourcePlayerID,
      targetPlayerID,
    };
  }

  return null;
};

/**
 * track SD Lantern usage
 */
const removeBuffProcessor: Processor<RemoveBuffEvent> = (
  event,
  { targetPlayerID }
) => {
  if (event.abilityGameID === SD_LANTERN_BUFF && targetPlayerID) {
    return {
      timestamp: event.timestamp,
      eventType: EventType.RemoveBuff,
      abilityID: event.abilityGameID,
      targetPlayerID,
    };
  }

  return null;
};

export type PersistedDungeonPull = Pick<
  Pull,
  "id" | "x" | "y" | "startTime" | "endTime" | "isWipe"
> & {
  maps: PullZone["zoneID"][];
  boundingBox: ReportMapBoundingBox;
  enemyNPCs: Pick<
    Required<DeepNonNullable<ReportDungeonPullNpc>>,
    "gameID" | "minimumInstanceID" | "maximumInstanceID" | "id"
  >[];
};

const getProcessorParams = (
  event: AnyEvent,
  pull: PersistedDungeonPull,
  actorPlayerMap: Map<number, number>
): Parameters<Processor<AnyEvent>>[1] => {
  const params: Parameters<Processor<AnyEvent>>[1] = {
    sourceNPCID: null,
    sourcePlayerID: null,
    targetNPCID: null,
    targetPlayerID: null,
  };

  if ("sourceID" in event) {
    params.sourcePlayerID = actorPlayerMap.get(event.sourceID) ?? null;
    params.sourceNPCID =
      pull.enemyNPCs.find((npc) => npc.id === event.sourceID)?.gameID ?? null;
  }

  if ("targetID" in event) {
    params.targetPlayerID = actorPlayerMap.get(event.targetID) ?? null;
    params.targetNPCID =
      pull.enemyNPCs.find((npc) => npc.id === event.targetID)?.gameID ?? null;
  }

  return params;
};

export const processEvents = (
  pull: PersistedDungeonPull,
  events: AnyEvent[],
  actorPlayerMap: Map<number, number>
): Omit<Prisma.EventCreateManyInput, "pullID">[] => {
  return events
    .map<Omit<Prisma.EventCreateManyInput, "pullID"> | null>((event) => {
      const params = getProcessorParams(event, pull, actorPlayerMap);

      switch (event.type) {
        case "applybuff":
          return applyBuffProcessor(event, params);
        case "applybuffstack":
          return applyBuffStackProcessor(event, params);
        case "applydebuff":
          return applyDebuffProcessor(event, params);
        case "begincast":
          return beginCastProcessor(event, params);
        case "cast":
          return castProcessor(event, params);
        case "damage":
          return damageProcessor(event, params);
        case "death":
          return deathProcessor(event, { ...params, pull });
        case "heal":
          return healProcessor(event, params);
        case "interrupt":
          return interruptProcessor(event, params);
        case "removebuff":
          return removeBuffProcessor(event, params);
        default:
          return null;
      }
    })
    .filter(
      (dataset): dataset is Omit<Prisma.EventCreateManyInput, "pullID"> =>
        dataset !== null
    );
};
