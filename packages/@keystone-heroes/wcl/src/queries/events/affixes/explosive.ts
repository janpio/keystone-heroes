import { EXPLOSIVE } from "@keystone-heroes/db/data";
import { EventDataType, HostilityType } from "@keystone-heroes/wcl/types";

import { loadEnemyNPCIDs } from "../../report";
import type { DamageEvent } from "../types";
import type { GetEventBaseParams, GetSourceIDParams } from "../utils";
import { getEvents, createEventFetcher } from "../utils";

export const getExplosiveKillEvents = async (
  params: GetEventBaseParams<{ fightID: number }>,
  explosiveID = -1
): Promise<DamageEvent[]> => {
  const sourceID =
    explosiveID === -1
      ? await getExplosiveSourceID({
          fightID: params.fightID,
          reportID: params.reportID,
        })
      : explosiveID;

  if (!sourceID) {
    return [];
  }

  const allEvents = await getEvents<DamageEvent>({
    ...params,
    dataType: EventDataType.DamageDone,
    hostilityType: HostilityType.Friendlies,
    targetID: sourceID,
  });

  return allEvents.filter((event) => event.overkill);
};

export const getExplosiveDamageTakenEvents = createEventFetcher<DamageEvent>({
  dataType: EventDataType.DamageTaken,
  hostilityType: HostilityType.Friendlies,
  abilityID: EXPLOSIVE.ability,
});

const getExplosiveSourceID = async (params: GetSourceIDParams) => {
  const response = await loadEnemyNPCIDs(
    {
      fightIDs: [params.fightID],
      reportID: params.reportID,
    },
    [EXPLOSIVE.unit]
  );

  return response[EXPLOSIVE.unit] ?? null;
};
