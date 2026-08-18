export type HouseholdRole = "OWNER" | "MEMBER";

export type HouseholdMember = {
  id: string;
  user_id: string;
  role: HouseholdRole;
  joined_at: string;
  left_at: string | null;
  profiles:
    | {
        full_name: string;
      }[]
    | null;
};

export type HouseholdInvitation = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "CANCELED" | "EXPIRED";
  expires_at: string;
  created_at: string;
};

export type HouseholdSummary = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};
