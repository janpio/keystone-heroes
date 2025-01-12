import { writeFileSync } from "fs";
import { getIntrospectionQuery, printSchema, buildClientSchema } from "graphql";
import { resolve } from "path";

import { getGqlClient } from "../client";

import type { IntrospectionQuery } from "graphql";

async function loadSchema() {
  const client = await getGqlClient();

  const response = await client.request<IntrospectionQuery>(
    getIntrospectionQuery()
  );

  const schema = printSchema(buildClientSchema(response));

  const targetPath = resolve("src/gql/schema.graphql");
  writeFileSync(targetPath, schema);
}

loadSchema()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("[@keystone-heroes/wcl] gql schema loaded");
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0);
  })
  // eslint-disable-next-line no-console
  .catch(console.error);
