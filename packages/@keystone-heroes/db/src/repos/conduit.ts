import { prisma } from "../client";
import { withPerformanceLogging } from "../utils";

import type { Conduit } from "@keystone-heroes/wcl/src/queries";
import type { Conduit as PrismaConduit } from "@prisma/client";

type CreateConduit = Omit<Conduit, "total" | "guid"> & {
  id: Conduit["guid"];
  itemLevel: Conduit["total"];
};

const createMany = async (data: CreateConduit[]): Promise<void> => {
  const payload = data.map<PrismaConduit>((conduit) => {
    return {
      id: conduit.id,
      icon: conduit.abilityIcon,
      name: conduit.name,
    };
  });

  await prisma.conduit.createMany({
    data: payload,
    skipDuplicates: true,
  });
};

export const ConduitRepo = {
  createMany: withPerformanceLogging(createMany, "ConduitRepo/createMany"),
};
