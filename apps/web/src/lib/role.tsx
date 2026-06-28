import React, { createContext, useContext, useState } from "react";

export type UserRole =
  | "REVIEWER"
  | "PHARMACY_ASSISTANT"
  | "PHARMACIST"
  | "DELIVERY_MAN"
  | "DATA_ENTRY"
  | "PLATFORM_ADMIN"
  | "PHYSICIAN"
  | "BRANCH_MANAGER"
  | "COSMETICIAN"
  | null;

export const ROLE_LABELS: Record<NonNullable<UserRole>, string> = {
  REVIEWER: "Clinical Reviewer",
  PHARMACY_ASSISTANT: "Pharmacy Assistant",
  PHARMACIST: "Pharmacist",
  DELIVERY_MAN: "Delivery Man",
  DATA_ENTRY: "Data Entry Operator",
  PLATFORM_ADMIN: "Platform Administrator",
  PHYSICIAN: "Physician",
  BRANCH_MANAGER: "Branch Manager",
  COSMETICIAN: "Cosmetician",
};

export const ROLE_HOME: Record<NonNullable<UserRole>, string> = {
  REVIEWER: "/reviewer",
  PHARMACY_ASSISTANT: "/pharmacy",
  PHARMACIST: "/pharmacist",
  DELIVERY_MAN: "/delivery",
  DATA_ENTRY: "/data-entry",
  PLATFORM_ADMIN: "/admin",
  PHYSICIAN: "/physician",
  BRANCH_MANAGER: "/branch-manager",
  COSMETICIAN: "/cosmetician",
};

export const ROLE_COLOR: Record<NonNullable<UserRole>, string> = {
  REVIEWER: "bg-violet-100 text-violet-800 border-violet-200",
  PHARMACY_ASSISTANT: "bg-amber-100 text-amber-800 border-amber-200",
  PHARMACIST: "bg-orange-100 text-orange-800 border-orange-200",
  DELIVERY_MAN: "bg-sky-100 text-sky-800 border-sky-200",
  DATA_ENTRY: "bg-slate-100 text-slate-800 border-slate-200",
  PLATFORM_ADMIN: "bg-rose-100 text-rose-800 border-rose-200",
  PHYSICIAN: "bg-blue-100 text-blue-800 border-blue-200",
  BRANCH_MANAGER: "bg-teal-100 text-teal-800 border-teal-200",
  COSMETICIAN: "bg-pink-100 text-pink-800 border-pink-200",
};

interface AuthUser {
  id: number;
  username: string;
  role: NonNullable<UserRole>;
  displayName: string;
  branchId: number | null;
}

interface RoleContextType {
  role: UserRole;
  user: AuthUser | null;
  setRole: (role: UserRole) => void;
  setUser: (user: AuthUser | null) => void;
  clearRole: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(null);
  const [user, setUserState] = useState<AuthUser | null>(null);

  const setRole = (r: UserRole) => setRoleState(r);
  const setUser = (u: AuthUser | null) => {
    setUserState(u);
    setRoleState(u ? u.role : null);
  };
  const clearRole = () => {
    setRoleState(null);
    setUserState(null);
  };

  return (
    <RoleContext.Provider value={{ role, user, setRole, setUser, clearRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}
