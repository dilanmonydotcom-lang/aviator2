import {
  FIELD_LIMITS,
  ID_PATTERN,
  type AppReleaseFormValues,
  type CloudinaryConfig,
  type GitHubRelease,
  type StorageProvider,
} from '../types/app';

const GITHUB_REPO_STORAGE_KEY = 'droidvault_github_repo';
const CLOUDINARY_STORAGE_KEY = 'droidvault_cloudinary_cfg';

export function loadSavedGitHubRepo(): string {
  try {
    return localStorage.getItem(GITHUB_REPO_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveGitHubRepo(repoSlug: string): void {
  try {
    localStorage.setItem(GITHUB_REPO_STORAGE_KEY, repoSlug.trim());
  } catch {
    // Ignore storage quota errors in restricted browsing contexts
  }
}

export function loadCloudinaryConfig(): CloudinaryConfig {
  try {
    const raw = localStorage.getItem(CLOUDINARY_STORAGE_KEY);
    if (!raw) return { cloudName: '', uploadPreset: '' };
    const parsed = JSON.parse(raw) as Partial<CloudinaryConfig>;
    return {
      cloudName: typeof parsed.cloudName === 'string' ? parsed.cloudName : '',
      uploadPreset: typeof parsed.uploadPreset === 'string' ? parsed.uploadPreset : '',
    };
  } catch {
    return { cloudName: '', uploadPreset: '' };
  }
}

export function saveCloudinaryConfig(config: CloudinaryConfig): void {
  try {
    localStorage.setItem(
      CLOUDINARY_STORAGE_KEY,
      JSON.stringify({
        cloudName: config.cloudName.trim(),
        uploadPreset: config.uploadPreset.trim(),
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function normalizeRepoSlug(input: string): string {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return cleaned;
}

export function getNewGitHubReleaseUrl(repoSlug: string): string {
  const slug = normalizeRepoSlug(repoSlug);
  if (!slug || !slug.includes('/')) {
    return 'https://github.com/new';
  }
  return `https://github.com/${slug}/releases/new`;
}

export async function fetchGitHubReleases(repoSlug: string): Promise<GitHubRelease[]> {
  const slug = normalizeRepoSlug(repoSlug);
  if (!slug || !/^[\w.-]+\/[\w.-]+$/.test(slug)) {
    throw new Error('Enter a valid GitHub repository slug in the format owner/repo.');
  }

  const response = await fetch(
    `https://api.github.com/repos/${slug}/releases?per_page=15`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (response.status === 404) {
    throw new Error(
      `Repository "${slug}" was not found or is private. Public repositories allow direct GitHub Releases APK downloads.`
    );
  }
  if (response.status === 403) {
    throw new Error('GitHub API rate limit reached. Try again in a few minutes.');
  }
  if (!response.ok) {
    throw new Error(`GitHub API returned status ${response.status}.`);
  }

  const data = (await response.json()) as GitHubRelease[];
  return Array.isArray(data) ? data : [];
}

export async function uploadToCloudinary(
  file: File,
  config: CloudinaryConfig,
  resourceType: 'image' | 'video' | 'auto' = 'image'
): Promise<{ secureUrl: string; bytes: number; originalFilename: string }> {
  const cloudName = config.cloudName.trim();
  const uploadPreset = config.uploadPreset.trim();
  if (!cloudName || !uploadPreset) {
    throw new Error('Set your Cloudinary Cloud Name and Unsigned Upload Preset first.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/upload`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json()) as {
    secure_url?: string;
    bytes?: number;
    original_filename?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload.secure_url) {
    throw new Error(payload.error?.message || 'Cloudinary upload failed.');
  }

  return {
    secureUrl: payload.secure_url,
    bytes: payload.bytes ?? file.size,
    originalFilename: payload.original_filename ?? file.name,
  };
}

export function normalizeDirectUrl(
  rawUrl: string,
  kind: 'apk' | 'image' | 'video'
): { url: string; detectedProvider?: StorageProvider } {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { url: '' };

  // Google Drive share link conversion
  const driveMatch =
    trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i) ||
    trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i) ||
    trimmed.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/i);

  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1];
    if (kind === 'image') {
      return {
        url: `https://lh3.googleusercontent.com/d/${fileId}`,
        detectedProvider: 'google-drive',
      };
    }
    if (kind === 'video') {
      return {
        url: `https://drive.google.com/file/d/${fileId}/preview`,
        detectedProvider: 'google-drive',
      };
    }
    return {
      url: `https://drive.google.com/uc?export=download&id=${fileId}`,
      detectedProvider: 'google-drive',
    };
  }

  // Dropbox link conversion
  if (/dropbox\.com/i.test(trimmed)) {
    const converted = trimmed.includes('dl=0')
      ? trimmed.replace('dl=0', 'dl=1')
      : trimmed.includes('dl=1')
        ? trimmed
        : `${trimmed}${trimmed.includes('?') ? '&' : '?'}dl=1`;
    return { url: converted, detectedProvider: 'cloud-link' };
  }

  // GitHub blob -> raw conversion for images/files
  const ghBlobMatch = trimmed.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i
  );
  if (ghBlobMatch) {
    const [, owner, repo, branch, path] = ghBlobMatch;
    return {
      url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
      detectedProvider: 'github-releases',
    };
  }

  if (/github\.com\/[^/]+\/[^/]+\/releases\/download\//i.test(trimmed)) {
    return { url: trimmed, detectedProvider: 'github-releases' };
  }

  if (/res\.cloudinary\.com/i.test(trimmed)) {
    return { url: trimmed, detectedProvider: 'cloudinary' };
  }

  return { url: trimmed };
}

export function getVideoEmbedInfo(
  url: string
): { type: 'youtube' | 'drive' | 'direct' | 'none'; src: string } {
  const trimmed = url.trim();
  if (!trimmed) return { type: 'none', src: '' };

  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      src: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`,
    };
  }

  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (driveMatch && driveMatch[1]) {
    return {
      type: 'drive',
      src: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
    };
  }

  if (/^https:\/\//i.test(trimmed)) {
    return { type: 'direct', src: trimmed };
  }

  return { type: 'none', src: '' };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 100 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

export function slugifyAppId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || `app-${Date.now()}`;
}

export function isAllowedAssetUrl(value: string, allowEmpty: boolean): boolean {
  const trimmed = value.trim();
  if (!trimmed) return allowEmpty;
  if (trimmed.length > FIELD_LIMITS.url) return false;
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('./src/assets/') ||
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('./assets/') ||
    trimmed.startsWith('/assets/')
  );
}

export function validateAppForm(values: AppReleaseFormValues): string | null {
  const id = values.id.trim();
  if (!id || id.length > FIELD_LIMITS.id || !ID_PATTERN.test(id)) {
    return 'Release ID must use only letters, numbers, hyphens, or underscores (max 128 chars).';
  }
  if (!values.name.trim() || values.name.trim().length > FIELD_LIMITS.name) {
    return `App name is required (max ${FIELD_LIMITS.name} characters).`;
  }
  if (!values.tagline.trim() || values.tagline.trim().length > FIELD_LIMITS.tagline) {
    return `Tagline is required (max ${FIELD_LIMITS.tagline} characters).`;
  }
  if (!values.version.trim() || values.version.trim().length > FIELD_LIMITS.version) {
    return `Version is required (max ${FIELD_LIMITS.version} characters).`;
  }
  if (!values.packageId.trim() || values.packageId.trim().length > FIELD_LIMITS.packageId) {
    return `Package ID is required (e.g. com.studio.app).`;
  }
  if (!values.apkUrl.trim() || !isAllowedAssetUrl(values.apkUrl, false)) {
    return 'A valid HTTPS download URL is required for the APK file.';
  }
  if (!values.apkFileName.trim() || values.apkFileName.trim().length > FIELD_LIMITS.fileName) {
    return 'APK file name is required.';
  }
  if (
    !Number.isFinite(values.apkSizeBytes) ||
    values.apkSizeBytes < 0 ||
    values.apkSizeBytes > FIELD_LIMITS.maxApkBytes
  ) {
    return 'APK size must be between 0 bytes and 2 GB.';
  }
  if (!isAllowedAssetUrl(values.iconUrl, true)) {
    return 'Icon URL must begin with https:// (or leave blank).';
  }
  if (!isAllowedAssetUrl(values.videoUrl, true)) {
    return 'Promo video URL must begin with https:// (or leave blank).';
  }
  const cleanShots = values.screenshots.map((s) => s.trim()).filter(Boolean);
  if (cleanShots.length > FIELD_LIMITS.maxScreenshots) {
    return `Maximum ${FIELD_LIMITS.maxScreenshots} screenshots allowed.`;
  }
  for (const shot of cleanShots) {
    if (!isAllowedAssetUrl(shot, false)) {
      return 'Every screenshot URL must begin with https://.';
    }
  }
  return null;
}

export interface SanitizedAppPayload {
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
  githubRepo?: string;
}

export function sanitizeAppPayload(values: AppReleaseFormValues): SanitizedAppPayload {
  const cleanScreenshots = values.screenshots
    .map((s) => normalizeDirectUrl(s, 'image').url.trim())
    .filter(Boolean)
    .slice(0, FIELD_LIMITS.maxScreenshots);

  const normalizedApk = normalizeDirectUrl(values.apkUrl, 'apk').url;
  const normalizedIcon = normalizeDirectUrl(values.iconUrl, 'image').url;
  const normalizedVideo = normalizeDirectUrl(values.videoUrl, 'video').url;

  const base: SanitizedAppPayload = {
    id: values.id.trim().slice(0, FIELD_LIMITS.id),
    name: values.name.trim().slice(0, FIELD_LIMITS.name),
    tagline: values.tagline.trim().slice(0, FIELD_LIMITS.tagline),
    description: values.description.trim().slice(0, FIELD_LIMITS.description),
    whatsNew: values.whatsNew.trim().slice(0, FIELD_LIMITS.whatsNew),
    version: values.version.trim().slice(0, FIELD_LIMITS.version),
    packageId: values.packageId.trim().slice(0, FIELD_LIMITS.packageId),
    category: values.category.trim().slice(0, FIELD_LIMITS.category) || 'Utilities',
    minAndroid: values.minAndroid.trim().slice(0, FIELD_LIMITS.minAndroid) || 'Android 10+',
    developer: values.developer.trim().slice(0, FIELD_LIMITS.developer) || 'DroidVault Studio',
    iconUrl: normalizedIcon.slice(0, FIELD_LIMITS.url),
    apkUrl: normalizedApk.slice(0, FIELD_LIMITS.url),
    apkFileName: values.apkFileName.trim().slice(0, FIELD_LIMITS.fileName),
    apkSizeBytes: Math.max(0, Math.min(FIELD_LIMITS.maxApkBytes, Math.round(values.apkSizeBytes || 0))),
    apkSha256: values.apkSha256.trim().slice(0, FIELD_LIMITS.sha256),
    screenshots: cleanScreenshots,
    videoUrl: normalizedVideo.slice(0, FIELD_LIMITS.url),
    videoFileName: values.videoFileName.trim().slice(0, FIELD_LIMITS.fileName),
    featured: Boolean(values.featured),
    published: Boolean(values.published),
    storageProvider: values.storageProvider,
  };

  const repoSlug = normalizeRepoSlug(values.githubRepo || '').slice(0, FIELD_LIMITS.githubRepo);
  if (repoSlug) {
    base.githubRepo = repoSlug;
  }
  return base;
}
