import { MIN_KEYSTONE_LEVEL } from "@keystone-heroes/env";

import { getCachedSdk } from "../client";

import type {
  EnemyNpcIdsQueryVariables,
  ExtendedReportDataQueryVariables,
  GameZone,
  InitialReportDataQueryVariables,
  Region,
  Report,
  ReportDungeonPullNpc,
  ReportFight,
  ReportFightNpc,
  ReportMap,
  ReportMapBoundingBox,
} from "../types";
import type { DeepNonNullable } from "ts-essentials";

type EnsuredNPC = Omit<ReportFightNpc, "gameID" | "id"> & {
  gameID: number;
  id: number;
};

export const loadEnemyNPCIDs = async (
  params: EnemyNpcIdsQueryVariables,
  gameIdOrIds: number | number[]
): Promise<Record<number, number>> => {
  const client = await getCachedSdk();
  const response = await client.EnemyNPCIds(params);

  const ids = new Set(Array.isArray(gameIdOrIds) ? gameIdOrIds : [gameIdOrIds]);

  return (
    response?.reportData?.report?.fights?.[0]?.enemyNPCs
      ?.filter(
        (npc): npc is EnsuredNPC =>
          npc?.gameID !== undefined &&
          npc?.gameID !== null &&
          ids.has(npc.gameID) &&
          typeof npc.id === "number"
      )
      .reduce<Record<number, number>>(
        (acc, npc) => ({
          ...acc,
          [npc.gameID]: npc.id,
        }),
        {}
      ) ?? {}
  );
};

export type InitialReportData = Pick<
  Report,
  "startTime" | "endTime" | "title"
> & {
  region: Pick<Region, "slug">;
  fights: ReportFight["id"][];
};

export const loadReportFromSource = async (
  params: InitialReportDataQueryVariables
): Promise<InitialReportData | null> => {
  try {
    const sdk = await getCachedSdk();
    const json = await sdk.InitialReportData(params);

    if (!json?.reportData?.report) {
      return null;
    }

    const { report } = json.reportData;

    if (!report.region || !report.fights) {
      return null;
    }

    return {
      startTime: report.startTime,
      endTime: report.endTime,
      title: report.title,
      region: {
        slug: report.region.slug,
      },
      fights: report.fights.reduce<InitialReportData["fights"][number][]>(
        (acc, fight) => {
          if (!fight || !fight.keystoneBonus || !fight.keystoneLevel) {
            return acc;
          }

          const { keystoneBonus, keystoneLevel, id } = fight;

          if (keystoneBonus === 0 || keystoneLevel < MIN_KEYSTONE_LEVEL) {
            return acc;
          }

          return [...acc, id];
        },
        []
      ),
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.trace(error);
    return null;
  }
};

export type ExtendedReportData = {
  averageItemLevel: number;
  keystoneTime: number;
  keystoneBonus: number;
  keystoneLevel: number;
  startTime: number;
  endTime: number;
  keystoneAffixes: number[];
  id: number;
  dungeonPulls: DungeonPull[];
  gameZone: Pick<GameZone, "id"> | null;
};

export type ExtendedReportDataWithGameZone = Omit<
  ExtendedReportData,
  "gameZone"
> & {
  gameZone: Pick<GameZone, "id">;
};

export type DungeonPull = {
  x: number;
  y: number;
  startTime: number;
  endTime: number;
  maps: number[];
  boundingBox: ReportMapBoundingBox;
  enemyNPCs: Pick<
    Required<DeepNonNullable<ReportDungeonPullNpc>>,
    "gameID" | "minimumInstanceID" | "maximumInstanceID" | "id"
  >[];
};

export const loadFightsFromSource = async (
  params: ExtendedReportDataQueryVariables
): Promise<ExtendedReportData[] | null> => {
  try {
    const sdk = await getCachedSdk();
    const json = await sdk.ExtendedReportData(params);

    if (!json?.reportData?.report?.fights) {
      return null;
    }

    return json.reportData.report.fights.reduce<ExtendedReportData[]>(
      (acc, fight) => {
        if (
          !fight ||
          !fight.keystoneAffixes ||
          !fight.dungeonPulls ||
          !fight.keystoneBonus ||
          !fight.keystoneLevel ||
          !fight.keystoneTime ||
          !fight.averageItemLevel ||
          fight.keystoneBonus === 0 ||
          fight.keystoneLevel < MIN_KEYSTONE_LEVEL ||
          fight.keystoneAffixes.length === 0 ||
          fight.keystoneTime === 0 ||
          fight.averageItemLevel === 0
        ) {
          return acc;
        }

        const {
          keystoneLevel,
          keystoneTime,
          averageItemLevel,
          id,
          startTime,
          endTime,
          keystoneBonus,
          gameZone = null,
        } = fight;

        const keystoneAffixes = fight.keystoneAffixes.filter(
          (affix): affix is number => affix !== null
        );

        const dungeonPulls = fight.dungeonPulls.reduce<DungeonPull[]>(
          (acc, pull) => {
            if (!pull || !pull.maps || !pull.enemyNPCs || !pull.boundingBox) {
              return acc;
            }

            const maps = pull.maps
              .filter((map): map is ReportMap => map !== null)
              .map((map) => map.id);

            if (maps.length === 0) {
              return acc;
            }

            const enemyNPCs = pull.enemyNPCs.filter(
              (enemyNPC): enemyNPC is DungeonPull["enemyNPCs"][number] =>
                enemyNPC !== null
            );

            if (enemyNPCs.length === 0) {
              return acc;
            }

            return [
              ...acc,
              {
                x: pull.x,
                y: pull.y,
                startTime: pull.startTime,
                endTime: pull.endTime,
                maps,
                boundingBox: pull.boundingBox,
                enemyNPCs,
              },
            ];
          },
          []
        );

        if (dungeonPulls.length === 0) {
          return acc;
        }

        return [
          ...acc,
          {
            id,
            startTime,
            endTime,
            keystoneAffixes,
            averageItemLevel,
            keystoneTime,
            keystoneBonus,
            keystoneLevel,
            dungeonPulls,
            gameZone,
          },
        ];
      },
      []
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.trace(error);
    return null;
  }
};
