import { reportHandler } from "@keystone-heroes/api/functions";
import nc from "next-connect";

export default nc().get(reportHandler);
