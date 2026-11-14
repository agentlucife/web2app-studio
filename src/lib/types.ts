export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  github_username: string | null;
  role: "user" | "admin";
  suspended: boolean;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  website_url: string;
  package_id: string;
  bundle_id: string | null;
  icon_url: string | null;
  splash_url: string | null;
  platforms: string[];
  repo_full_name: string | null;
  repo_branch: string;
  repo_private: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BuildStatus =
  | "queued"
  | "preparing"
  | "building"
  | "uploading"
  | "completed"
  | "failed"
  | "cancelled";

export type Build = {
  id: string;
  project_id: string;
  user_id: string;
  platform: "android" | "ios";
  build_type: string;
  status: BuildStatus;
  workflow_run_id: number | null;
  workflow_run_url: string | null;
  workflow_name: string | null;
  commit_sha: string | null;
  signing_mode: string | null;
  artifact_name: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BuildLog = {
  id: string;
  build_id: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  created_at: string;
};

export type Artifact = {
  id: string;
  build_id: string | null;
  project_id: string | null;
  user_id: string;
  name: string;
  storage_path: string;
  size_bytes: number | null;
  content_type: string | null;
  kind: "apk" | "aab" | "ipa" | "xcarchive" | "source" | "log";
  checksum: string | null;
  created_at: string;
};

export type GithubConnection = {
  id: string;
  user_id: string;
  github_user_id: number | null;
  github_username: string | null;
  avatar_url: string | null;
  token_type: "pat" | "oauth";
  scopes: string[];
  connected_at: string;
  updated_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  plan: "free" | "pro" | "enterprise";
  status: "active" | "past_due" | "cancelled";
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
  build_id: string | null;
  created_at: string;
};

export type SupportTicket = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "closed";
  created_at: string;
  updated_at: string;
};
