import {
  expansions,
  affixes as allAffixes,
  dungeonMap,
  dungeons,
  seasons,
  getAffixById,
  weeks as allWeeks,
} from "@keystone-heroes/db/data";

import type { Affix, Dungeon as DungeonType, Season } from "@prisma/client";
import type { GetStaticPaths, GetStaticProps } from "next";

type DungeonProps = {
  dungeon: DungeonType;
  season: Omit<Season, "startTime" | "endTime" | "affixID" | "expansionID">;
  affixes: Affix[];
};

export default function Dungeon({
  dungeon,
  season,
  affixes,
}: DungeonProps): JSX.Element {
  return (
    <>
      <h1>{season.name}</h1>

      <h2>Current Affixes</h2>
      {affixes.map((affix) => {
        return <div key={affix.id}>{affix.name}</div>;
      })}

      <h2>Dungeon</h2>
      {dungeon.name}
    </>
  );
}

type StaticParams = {
  dungeon: string;
  season: string;
  affixes: string;
};

export const getStaticPaths: GetStaticPaths<StaticParams> = async () => {
  const paths = seasons.flatMap((season) => {
    const weeks = allWeeks.filter((week) => week.seasonID === season.id);

    return weeks.flatMap((week) => {
      const affixSlug = [
        getAffixById(week.affix1ID),
        getAffixById(week.affix2ID),
        getAffixById(week.affix3ID),
        getAffixById(season.affixID),
      ]
        .map((affix) => affix.name.toLowerCase())
        .join("-");

      return expansions.flatMap((expansion) => {
        return expansion.dungeonIds.map((id) => {
          const dungeon = dungeonMap[id];

          if (!dungeon) {
            throw new Error("unknown dungeon id");
          }

          return {
            params: {
              affixes: affixSlug,
              season: season.slug,
              dungeon: dungeon.slug.toLocaleLowerCase(),
            },
          };
        });
      });
    });
  });

  return {
    fallback: false,
    paths,
  };
};

export const getStaticProps: GetStaticProps<DungeonProps, StaticParams> =
  async ({ params }) => {
    if (
      !params?.affixes ||
      !params?.dungeon ||
      !params?.season ||
      Array.isArray(params.affixes) ||
      Array.isArray(params.dungeon) ||
      Array.isArray(params.season) ||
      !params.affixes.includes("-")
    ) {
      throw new Error("nope");
    }

    const season = seasons.find((season) => season.slug === params.season);

    if (!season) {
      throw new Error("nope");
    }

    const dungeon = dungeons.find(
      (dungeon) => dungeon.slug.toLowerCase() === params.dungeon
    );

    if (!dungeon) {
      throw new Error("unknown dungeon slug");
    }

    const dataset: DungeonType = {
      id: dungeon.id,
      name: dungeon.name,
      slug: dungeon.slug,
      time: dungeon.timer[0],
    };

    const affixSlugs = params.affixes.split("-");
    const affixes = allAffixes.filter((affix) =>
      affixSlugs.includes(affix.name.toLowerCase())
    );

    return {
      props: {
        affixes,
        dungeon: dataset,
        season: {
          id: season.id,
          name: season.name,
          slug: season.slug,
        },
      },
    };
  };
