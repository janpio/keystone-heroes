import {
  weeks as allWeeks,
  seasons,
  dungeons,
  getAffixById,
  affixes as allAffixes,
} from "@keystone-heroes/db/data";
import Link from "next/link";

import type { Affix, Dungeon, Season } from "@prisma/client";
import type { GetStaticPaths, GetStaticProps } from "next";

type AffixesProps = {
  affixSlug: string;
  affixes: Affix[];
  season: Omit<Season, "startTime" | "endTime" | "affixID" | "expansionID">;
  dungeons: Omit<Dungeon, "time">[];
};

export default function Affixes({
  affixes,
  season,
  dungeons,
  affixSlug,
}: AffixesProps): JSX.Element {
  return (
    <>
      <h1>{season.name}</h1>
      <hr />

      <h2>Current Affixes</h2>
      {affixes.map((affix) => {
        return <div key={affix.id}>{affix.name}</div>;
      })}

      <h2>Dungeons</h2>

      {dungeons.map((dungeon) => {
        return (
          <div key={dungeon.id}>
            <Link
              href={`/routes/${
                season.slug
              }/${affixSlug}/${dungeon.slug.toLowerCase()}`}
            >
              <a>{dungeon.name}</a>
            </Link>
          </div>
        );
      })}
    </>
  );
}

type StaticParams = {
  season: string;
  affixes: string;
};

export const getStaticPaths: GetStaticPaths<StaticParams> = async () => {
  const paths = seasons.flatMap((season) => {
    const weeks = allWeeks.filter((week) => week.seasonID === season.id);

    return weeks.map((week) => {
      const affixSlug = [
        getAffixById(week.affix1ID),
        getAffixById(week.affix2ID),
        getAffixById(week.affix3ID),
        getAffixById(season.affixID),
      ]
        .map((affix) => affix.name.toLowerCase())
        .join("-");

      return {
        params: {
          affixes: affixSlug,
          season: season.slug,
        },
      };
    });
  });

  return {
    fallback: false,
    paths,
  };
};

export const getStaticProps: GetStaticProps<AffixesProps, StaticParams> =
  async ({ params }) => {
    if (
      !params?.affixes ||
      !params?.season ||
      Array.isArray(params.affixes) ||
      Array.isArray(params.season) ||
      !params.affixes.includes("-")
    ) {
      throw new Error("nope");
    }

    const affixSlug = params.affixes;
    const affixSlugs = affixSlug.split("-");
    const affixes = allAffixes.filter((affix) =>
      affixSlugs.includes(affix.name.toLowerCase())
    );

    const seasonSlug = params.season;
    const season = seasons.find((season) => season.slug === seasonSlug);

    if (!season) {
      throw new Error("nope");
    }

    return {
      props: {
        affixSlug,
        affixes,
        season: {
          id: season.id,
          name: season.name,
          slug: season.slug,
        },
        dungeons: dungeons
          .filter((dungeon) => dungeon.expansionID === season.expansionID)
          .map((dungeon) => {
            return {
              id: dungeon.id,
              name: dungeon.name,
              slug: dungeon.slug,
            };
          }),
      },
    };
  };
