// types/accounts.ts

export type AccountType =
  | { type: "demo" }
  | { type: "real" }
  | { type: "tournament"; tournamentId: string };

export type TournamentAccount = {
  id: string;
  name: string;
  balance: number;
  status: "live" | "upcoming" | "closed";
};
