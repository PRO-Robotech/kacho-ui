// IAM API types + helpers — flat resources verbatim из kacho.cloud.iam.v1.
// URL-ы из google.api.http annotations в kacho-proto/proto/kacho/cloud/iam/v1/*.
//
// Все мутации возвращают Operation envelope (см. operation.proto).
// Список ресурсов:
//   - /iam/v1/accounts              (AccountService)
//   - /iam/v1/projects              (ProjectService; require account_id)
//   - /iam/v1/users                 (UserService; read+delete only)
//   - /iam/v1/serviceAccounts       (ServiceAccountService; require account_id)
//   - /iam/v1/groups                (GroupService; require account_id; +addMember/removeMember/listMembers)
//   - /iam/v1/roles                 (RoleService; system + custom)
//   - /iam/v1/accessBindings        (AccessBindingService; Create/Delete/Get + listByResource/listBySubject)
//
// E0 (текущая фаза): без auth-interceptor; UI шлёт запросы без Bearer
// (api-gateway допускает анонимный доступ). Operations.principal_* — пусто/stub.

import { api } from "./client";

// ====== Account ======
export interface Account {
  id: string;
  name: string;
  description?: string;
  labels?: Record<string, string>;
  owner_user_id?: string;
  created_at?: string;
}
export interface AccountList {
  accounts: Account[];
  next_page_token?: string;
}

// ====== Project ======
export interface Project {
  id: string;
  account_id?: string;
  name: string;
  description?: string;
  labels?: Record<string, string>;
  created_at?: string;
}
export interface ProjectList {
  projects: Project[];
  next_page_token?: string;
}

// ====== User ======
export interface User {
  id: string;
  external_id?: string;
  email?: string;
  display_name?: string;
  created_at?: string;
}
export interface UserList {
  users: User[];
  next_page_token?: string;
}

// ====== ServiceAccount ======
export interface ServiceAccount {
  id: string;
  account_id?: string;
  name: string;
  description?: string;
  created_at?: string;
}
export interface ServiceAccountList {
  service_accounts: ServiceAccount[];
  next_page_token?: string;
}

// ====== Group ======
export interface Group {
  id: string;
  account_id?: string;
  name: string;
  description?: string;
  labels?: Record<string, string>;
  created_at?: string;
}
export interface GroupList {
  groups: Group[];
  next_page_token?: string;
}
export interface GroupMember {
  member_type: string; // "user" | "service_account"
  member_id: string;
  added_at?: string;
}
export interface GroupMemberList {
  members: GroupMember[];
  next_page_token?: string;
}

// ====== Role ======
export interface Role {
  id: string;
  account_id?: string;
  name: string;
  description?: string;
  permissions?: string[];
  is_system?: boolean;
  created_at?: string;
}
export interface RoleList {
  roles: Role[];
  next_page_token?: string;
}

// ====== AccessBinding ======
export type SubjectType = "user" | "service_account" | "group";
export type ResourceType = "account" | "project" | "folder" | string;

export interface AccessBinding {
  id: string;
  subject_type: string;
  subject_id: string;
  role_id: string;
  resource_type: string;
  resource_id: string;
  created_at?: string;
}
export interface AccessBindingList {
  access_bindings: AccessBinding[];
  next_page_token?: string;
}

// ====== Endpoints map ======
export const IAM = {
  accounts: "/iam/v1/accounts",
  projects: "/iam/v1/projects",
  users: "/iam/v1/users",
  serviceAccounts: "/iam/v1/serviceAccounts",
  groups: "/iam/v1/groups",
  roles: "/iam/v1/roles",
  accessBindings: "/iam/v1/accessBindings",
} as const;

// ====== List helpers (без auth) ======
export const iamApi = {
  // Accounts
  listAccounts: (q?: Record<string, string>) =>
    api.list<AccountList>(IAM.accounts, q),
  // Projects — account_id обязателен по proto, но handler допускает list-all.
  listProjects: (q?: Record<string, string>) =>
    api.list<ProjectList>(IAM.projects, q),
  // Users
  listUsers: (q?: Record<string, string>) =>
    api.list<UserList>(IAM.users, q),
  // SAs
  listServiceAccounts: (q?: Record<string, string>) =>
    api.list<ServiceAccountList>(IAM.serviceAccounts, q),
  // Groups
  listGroups: (q?: Record<string, string>) =>
    api.list<GroupList>(IAM.groups, q),
  // Group members — custom GET endpoint /iam/v1/groups/{group_id}:listMembers
  listGroupMembers: (groupId: string, q?: Record<string, string>) =>
    api.list<GroupMemberList>(`${IAM.groups}/${groupId}:listMembers`, q),
  // Roles
  listRoles: (q?: Record<string, string>) =>
    api.list<RoleList>(IAM.roles, q),
  // AccessBindings: list-by-resource + list-by-subject (custom verbs)
  listAccessBindingsByResource: (resource_type: string, resource_id: string, q?: Record<string, string>) =>
    api.list<AccessBindingList>(`${IAM.accessBindings}:listByResource`, {
      resource_type,
      resource_id,
      ...(q ?? {}),
    }),
  listAccessBindingsBySubject: (subject_type: string, subject_id: string, q?: Record<string, string>) =>
    api.list<AccessBindingList>(`${IAM.accessBindings}:listBySubject`, {
      subject_type,
      subject_id,
      ...(q ?? {}),
    }),
};
