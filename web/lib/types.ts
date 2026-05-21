export type Unit = "g" | "kg" | "ml" | "L" | "pcs" | "bunch" | "pack";

export type Category =
  | "produce"
  | "dairy"
  | "meat"
  | "seafood"
  | "pantry"
  | "frozen"
  | "bakery"
  | "condiment"
  | "beverage"
  | "other";

export type Role = "owner" | "member";

export interface DbUser {
  id: string;
  display_name: string;
  telegram_user_id: number | null;
  telegram_chat_id: number | null;
  link_code: string | null;
  active_household_id: string | null;
  created_at: string;
}

export interface DbHousehold {
  id: string;
  name: string;
  owner_user_id: string;
  invite_code: string;
  created_at: string;
}

export interface DbHouseholdMember {
  household_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
}

export interface DbItem {
  id: string;
  household_id: string;
  created_by_user_id: string | null;
  name: string;
  normalized_name: string;
  quantity: number;
  unit: Unit;
  category: Category | null;
  added_at: string;
  expires_at: string | null;
  low_threshold: number | null;
  typical_purchase_quantity: number | null;
  notes: string | null;
}

export interface DbShoppingListRow {
  id: string;
  household_id: string;
  name: string;
  normalized_name: string;
  quantity_wanted: number | null;
  unit: string | null;
  source: "auto_low_stock" | "auto_used_up" | "manual" | "recipe_planned";
  linked_item_id: string | null;
  done: boolean;
  done_at: string | null;
  created_at: string;
}

export interface ParsedAddItem {
  name: string;
  quantity: number;
  unit: Unit;
  category: Category;
  expires_in_days: number;
  low_threshold: number | null;
  typical_purchase_quantity: number;
}
