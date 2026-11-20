import type { Timestamp } from 'firebase/firestore';

export type StorageProvider =
  | 'github-releases'
  | 'cloudinary'
  | 'cloud-link'
  | 'google-drive';

export const STORAGE_PROVIDER_LABELS: Record<StorageProvider, string> = {
  'github-releases': 'GitHub Releases',
  cloudinary: 'Cloudinary CDN',
  'cloud-link': 'Direct Cloud Link',
  'google-drive': 'Google Drive',
};

export const APP_CATEGORIES = [
  'All',
  'Productivity',
  'Utilities',
  'Media & Audio',
  'Developer Tools',
  'Education',
  'Games',
] as const;

export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const FIELD_LIMITS = {
  id: 128,
  name: 120,
  tagline: 240,
  description: 5000,
  whatsNew: 3000,
  version: 40,
  packageId: 160,
  category: 80,
  minAndroid: 40,
  developer: 120,
  url: 2048,
  fileName: 200,
  sha256: 128,
  githubRepo: 160,
  maxScreenshots: 4,
  maxApkBytes: 2147483648, // 2 GB
} as const;

export interface AppRelease {
  id: string;
  name: string;
  tagline: string;
  description: string;
  whatsNew: string;
  version: string;
  packageId: string;
  category: string;
  minAndroid: string;
  developer: string;
  iconUrl: string;
  apkUrl: string;
  apkFileName: string;
  apkSizeBytes: number;
  apkSha256: string;
  screenshots: string[];
  videoUrl: string;
  videoFileName: string;
  downloads: number;
  featured: boolean;
  published: boolean;
  storageProvider: StorageProvider;
  githubRepo?: string;
  ownerUid: string;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  isPreviewSample?: boolean;
}

export interface AppReleaseFormValues {
  id: string;
  name: string;
  tagline: string;
  description: string;
  whatsNew: string;
  version: string;
  packageId: string;
  category: string;
  minAndroid: string;
  developer: string;
  iconUrl: string;
  apkUrl: string;
  apkFileName: string;
  apkSizeBytes: number;
  apkSha256: string;
  screenshots: string[];
  videoUrl: string;
  videoFileName: string;
  featured: boolean;
  published: boolean;
  storageProvider: StorageProvider;
  githubRepo: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'user';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface DownloadRecord {
  id: string;
  userId: string;
  appId: string;
  appName: string;
  version: string;
  downloadedAt?: Timestamp | null;
}

export interface GitHubReleaseAsset {
  id: number;
  name: string;
  size: number;
  download_count: number;
  browser_download_url: string;
  content_type: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: GitHubReleaseAsset[];
}

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
}
