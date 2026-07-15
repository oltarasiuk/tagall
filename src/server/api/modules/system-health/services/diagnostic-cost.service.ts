import type { DiagnosticCost } from "../types/health.type";
import { ZERO_COST } from "./health-components.service";

export const sumCosts = (costs: Partial<DiagnosticCost>[]): DiagnosticCost =>
  costs.reduce<DiagnosticCost>(
    (total, current) => ({
      databaseQueries: total.databaseQueries + (current.databaseQueries ?? 0),
      redisCommands: total.redisCommands + (current.redisCommands ?? 0),
      externalApiRequests:
        total.externalApiRequests + (current.externalApiRequests ?? 0),
      cloudinaryOperations:
        total.cloudinaryOperations + (current.cloudinaryOperations ?? 0),
      potentiallyBillable:
        total.potentiallyBillable || Boolean(current.potentiallyBillable),
    }),
    { ...ZERO_COST },
  );
