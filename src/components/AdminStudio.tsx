import React, { useMemo, useState } from 'react';
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  AlertCircle,
  Check,
  CloudUpload,
  ExternalLink,
  Film,
  GitBranch,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  db,
  FIREBASE_PROJECT_ID,
  handleFirestoreError,
  OperationType,
  PRIMARY_ADMIN_EMAIL,
} from '../lib/firebase';
import { STARTER_SAMPLE_APPS } from '../lib/seedData';
import {
  fetchGitHubReleases,
  formatBytes,
  getNewGitHubReleaseUrl,
  getVideoEmbedInfo,
  loadCloudinaryConfig,
  loadSavedGitHubRepo,
  normalizeDirectUrl,
  normalizeRepoSlug,
  sanitizeAppPayload,
  saveCloudinaryConfig,
  saveGitHubRepo,
  slugifyAppId,
  uploadToCloudinary,
  validateAppForm,
} from '../lib/storage';
import {
  APP_CATEGORIES,
  STORAGE_PROVIDER_LABELS,
  type AppRelease,
  type AppReleaseFormValues,
  type CloudinaryConfig,
  type GitHubRelease,
  type GitHubReleaseAsset,
  type StorageProvider,
} from '../types/app';
import { AppImage } from './AppImage';
import { GitHubPublishGuide } from './GitHubPublishGuide';

interface AdminStudioProps {
  apps: AppRelease[];
  hasFirestoreApps: boolean;
}

const EMPTY_FORM = (defaultRepo: string): AppReleaseFormValues => ({
  id: '',
  name: '',
  tagline: '',
  description: '',
  whatsNew: '',
  version: '1.0.0',
  packageId: 'com.droidvault.app',
  category: 'Utilities',
  minAndroid: 'Android 10+',
  developer: 'DroidVault Studio',
  iconUrl: '',
  apkUrl: '',
  apkFileName: '',
  apkSizeBytes: 0,
  apkSha256: '',
  screenshots: ['', '', '', ''],
  videoUrl: '',
  videoFileName: '',
  featured: false,
  published: true,
  storageProvider: 'github-releases',
  githubRepo: defaultRepo,
});

function isVideoFileName(fileName: string): boolean {
  return /\.(mp4|webm|mov|m4v)$/i.test(fileName);
}

export function AdminStudio({ apps, hasFirestoreApps }: AdminStudioProps) {
  const { user, isAdminUnlocked, isVerifiedBootstrappedAdmin } = useAuth();

  const [studioSection, setStudioSection] = useState<'uploads' | 'deploy'>('uploads');
  const [githubRepo, setGithubRepo] = useState(() => loadSavedGitHubRepo());
  const [cloudinaryCfg, setCloudinaryCfg] = useState<CloudinaryConfig>(() =>
    loadCloudinaryConfig()
  );
  const [storageTab, setStorageTab] = useState<'github' | 'cloudinary' | 'links'>('github');

  // GitHub Releases browser state
  const [ghReleases, setGhReleases] = useState<GitHubRelease[]>([]);
  const [fetchingGh, setFetchingGh] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);

  // Release form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AppReleaseFormValues>(() =>
    EMPTY_FORM(loadSavedGitHubRepo())
  );
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const realApps = useMemo(
    () => apps.filter((a) => !a.isPreviewSample),
    [apps]
  );

  const videoPreview = useMemo(
    () => getVideoEmbedInfo(form.videoUrl),
    [form.videoUrl]
  );

  if (!isAdminUnlocked) {
    return null;
  }

  const canWriteToFirestore = Boolean(user && isVerifiedBootstrappedAdmin);

  const updateField = <K extends keyof AppReleaseFormValues>(
    key: K,
    value: AppReleaseFormValues[K]
  ) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && !editingId && !prev.id) {
        next.id = slugifyAppId(String(value));
      }
      return next;
    });
  };

  const handleFetchGitHub = async () => {
    const slug = normalizeRepoSlug(githubRepo);
    if (!slug) {
      setGhError('Enter a repository slug such as username/my-android-apps.');
      return;
    }
    saveGitHubRepo(slug);
    setGithubRepo(slug);
    setFetchingGh(true);
    setGhError(null);
    try {
      const releases = await fetchGitHubReleases(slug);
      setGhReleases(releases);
      if (releases.length === 0) {
        setGhError(
          `No published releases found in "${slug}". Create a release on GitHub and attach your .apk and .mp4 video files.`
        );
      }
    } catch (err) {
      setGhError(err instanceof Error ? err.message : 'Failed to fetch GitHub Releases.');
    } finally {
      setFetchingGh(false);
    }
  };

  const handleImportApkAsset = (
    release: GitHubRelease,
    asset: GitHubReleaseAsset
  ) => {
    const cleanVersion = release.tag_name.replace(/^v/i, '') || '1.0.0';
    const guessedName =
      form.name ||
      release.name?.replace(/\s*v?\d+(\.\d+)*.*$/i, '').trim() ||
      asset.name.replace(/\.apk$/i, '');

    setForm((prev) => ({
      ...prev,
      name: prev.name || guessedName,
      id: prev.id || slugifyAppId(guessedName),
      version: cleanVersion,
      apkUrl: asset.browser_download_url,
      apkFileName: asset.name,
      apkSizeBytes: asset.size,
      whatsNew: prev.whatsNew || (release.body ? release.body.slice(0, 2500) : ''),
      storageProvider: 'github-releases',
      githubRepo: normalizeRepoSlug(githubRepo),
    }));

    setFeedback({
      type: 'success',
      text: `Imported APK ${asset.name} (${formatBytes(asset.size)}) from release ${release.tag_name}.`,
    });
  };

  const handleImportVideoAsset = (asset: GitHubReleaseAsset) => {
    setForm((prev) => ({
      ...prev,
      videoUrl: asset.browser_download_url,
      videoFileName: asset.name.slice(0, 200),
    }));
    setFeedback({
      type: 'success',
      text: `Imported app video ${asset.name} (${formatBytes(asset.size)}).`,
    });
  };

  const handleCloudinaryUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    target: 'icon' | 'video' | number
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const slotKey = String(target);
    setUploadingSlot(slotKey);
    setFeedback(null);
    try {
      saveCloudinaryConfig(cloudinaryCfg);
      const resourceType = target === 'video' ? 'video' : 'image';
      const uploaded = await uploadToCloudinary(file, cloudinaryCfg, resourceType);
      if (target === 'icon') {
        updateField('iconUrl', uploaded.secureUrl);
      } else if (target === 'video') {
        setForm((prev) => ({
          ...prev,
          videoUrl: uploaded.secureUrl,
          videoFileName: file.name.slice(0, 200),
        }));
      } else {
        setForm((prev) => {
          const nextShots = [...prev.screenshots];
          while (nextShots.length < 4) nextShots.push('');
          nextShots[target] = uploaded.secureUrl;
          return { ...prev, screenshots: nextShots };
        });
      }
      setFeedback({
        type: 'success',
        text: `Uploaded ${file.name} directly to Cloudinary CDN.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Cloudinary upload failed.',
      });
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleNormalizeUrlField = (
    field: 'apkUrl' | 'iconUrl' | 'videoUrl',
    kind: 'apk' | 'image' | 'video'
  ) => {
    const { url, detectedProvider } = normalizeDirectUrl(form[field], kind);
    setForm((prev) => ({
      ...prev,
      [field]: url,
      ...(field === 'apkUrl' && detectedProvider
        ? { storageProvider: detectedProvider }
        : {}),
    }));
  };

  const handleStartEdit = (app: AppRelease) => {
    setEditingId(app.id);
    const paddedShots = [...(app.screenshots || [])];
    while (paddedShots.length < 4) paddedShots.push('');
    setForm({
      id: app.id,
      name: app.name,
      tagline: app.tagline,
      description: app.description,
      whatsNew: app.whatsNew,
      version: app.version,
      packageId: app.packageId,
      category: app.category,
      minAndroid: app.minAndroid,
      developer: app.developer,
      iconUrl: app.iconUrl,
      apkUrl: app.apkUrl,
      apkFileName: app.apkFileName,
      apkSizeBytes: app.apkSizeBytes,
      apkSha256: app.apkSha256,
      screenshots: paddedShots.slice(0, 4),
      videoUrl: app.videoUrl,
      videoFileName: app.videoFileName,
      featured: app.featured,
      published: app.published,
      storageProvider: app.storageProvider,
      githubRepo: app.githubRepo || githubRepo,
    });
    setStudioSection('uploads');
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM(githubRepo));
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!canWriteToFirestore || !user) {
      setFeedback({
        type: 'error',
        text: `Enable Authentication → Sign-in method → Email/Password in Firebase Console, then sign in again with ${PRIMARY_ADMIN_EMAIL} to save releases.`,
      });
      return;
    }

    const validationError = validateAppForm(form);
    if (validationError) {
      setFeedback({ type: 'error', text: validationError });
      return;
    }

    const payload = sanitizeAppPayload(form);
    const docId = editingId || payload.id;
    const docPath = `apps/${docId}`;

    setSaving(true);
    try {
      if (editingId) {
        const existingApp = realApps.find((a) => a.id === editingId);
        await updateDoc(doc(db, 'apps', docId), {
          name: payload.name,
          tagline: payload.tagline,
          description: payload.description,
          whatsNew: payload.whatsNew,
          version: payload.version,
          packageId: payload.packageId,
          category: payload.category,
          minAndroid: payload.minAndroid,
          developer: payload.developer,
          iconUrl: payload.iconUrl,
          apkUrl: payload.apkUrl,
          apkFileName: payload.apkFileName,
          apkSizeBytes: payload.apkSizeBytes,
          apkSha256: payload.apkSha256,
          screenshots: payload.screenshots,
          videoUrl: payload.videoUrl,
          videoFileName: payload.videoFileName,
          featured: payload.featured,
          published: payload.published,
          storageProvider: payload.storageProvider,
          ...(payload.githubRepo ? { githubRepo: payload.githubRepo } : {}),
          updatedAt: serverTimestamp(),
        });
        setFeedback({
          type: 'success',
          text: `Updated "${existingApp?.name || payload.name}" (v${payload.version}).`,
        });
      } else {
        await setDoc(doc(db, 'apps', docId), {
          ...payload,
          id: docId,
          downloads: 0,
          ownerUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setFeedback({
          type: 'success',
          text: `Published "${payload.name}" (v${payload.version}) to the storefront.`,
        });
      }
      setEditingId(null);
      setForm(EMPTY_FORM(githubRepo));
    } catch (error) {
      handleFirestoreError(
        error,
        editingId ? OperationType.UPDATE : OperationType.CREATE,
        docPath
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (app: AppRelease) => {
    if (!canWriteToFirestore) return;
    const docPath = `apps/${app.id}`;
    try {
      await updateDoc(doc(db, 'apps', app.id), {
        published: !app.published,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
  };

  const handleSetFeatured = async (targetApp: AppRelease) => {
    if (!canWriteToFirestore) return;
    const batch = writeBatch(db);
    try {
      for (const app of realApps) {
        if (app.id === targetApp.id || app.featured) {
          batch.update(doc(db, 'apps', app.id), {
            featured: app.id === targetApp.id,
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `apps/${targetApp.id}`);
    }
  };

  const handleDeleteApp = async (appId: string) => {
    if (!canWriteToFirestore) return;
    const docPath = `apps/${appId}`;
    try {
      await deleteDoc(doc(db, 'apps', appId));
      setConfirmDeleteId(null);
      if (editingId === appId) {
        handleResetForm();
      }
      setFeedback({ type: 'success', text: 'Release deleted.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  };

  const handleSeedStarterCatalog = async () => {
    if (!canWriteToFirestore || !user) return;
    setSeeding(true);
    setFeedback(null);
    try {
      const batch = writeBatch(db);
      for (const sample of STARTER_SAMPLE_APPS) {
        const { isPreviewSample: _ignore, ...cleanSample } = sample;
        batch.set(doc(db, 'apps', sample.id), {
          ...cleanSample,
          ownerUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setFeedback({
        type: 'success',
        text: 'Starter releases saved to Firestore. You can edit or replace each release anytime.',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'apps/starter-seed');
    } finally {
      setSeeding(false);
    }
  };

  const cloudinaryReady =
    Boolean(cloudinaryCfg.cloudName.trim()) &&
    Boolean(cloudinaryCfg.uploadPreset.trim());

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight">
            Admin Panel
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Upload Android APKs, attach app demo videos, and manage published releases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
            <button
              type="button"
              onClick={() => setStudioSection('uploads')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                studioSection === 'uploads'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              APK &amp; Video Uploads
            </button>
            <button
              type="button"
              onClick={() => setStudioSection('deploy')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                studioSection === 'deploy'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              GitHub &amp; Storage Guide
            </button>
          </div>

          {!hasFirestoreApps && canWriteToFirestore && (
            <button
              type="button"
              disabled={seeding}
              onClick={() => void handleSeedStarterCatalog()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-900 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              {seeding ? 'Saving...' : 'Seed Starter Apps'}
            </button>
          )}
        </div>
      </div>

      {/* Firebase Email/Password Provider Notice (Shown ONLY if Email/Password isn't enabled in Firebase yet) */}
      {!canWriteToFirestore && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-xs text-amber-950 leading-relaxed">
              <p className="font-semibold text-sm">
                Enable Email/Password in Firebase Console to save releases
              </p>
              <p>
                No email verification is required. Simply turn on{' '}
                <strong>Authentication → Sign-in method → Email/Password</strong> in Firebase Console once, then sign out and sign back in with{' '}
                <code className="font-mono">{PRIMARY_ADMIN_EMAIL}</code>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pl-8">
            <a
              href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-900 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors"
            >
              Open Firebase Auth Console
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {studioSection === 'deploy' ? (
        <GitHubPublishGuide />
      ) : (
        <>
          {feedback && (
            <div
              role="status"
              className={`px-4 py-3 rounded-lg border text-sm flex items-center justify-between gap-4 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <span>{feedback.text}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-xs font-semibold underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Storage Connector Panel */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-zinc-950">
                  APK &amp; Video Storage Connector
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Import up to 2 GB APKs and MP4 demo videos from GitHub Releases, or upload media directly via Cloudinary.
                </p>
              </div>
              <div className="inline-flex items-center gap-1 p-1 bg-zinc-100 rounded-lg self-start">
                <button
                  type="button"
                  onClick={() => setStorageTab('github')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    storageTab === 'github'
                      ? 'bg-white text-zinc-950 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  GitHub Releases
                </button>
                <button
                  type="button"
                  onClick={() => setStorageTab('cloudinary')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    storageTab === 'cloudinary'
                      ? 'bg-white text-zinc-950 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  Cloudinary Direct Upload
                </button>
                <button
                  type="button"
                  onClick={() => setStorageTab('links')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    storageTab === 'links'
                      ? 'bg-white text-zinc-950 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  Cloud Link Helper
                </button>
              </div>
            </div>

            {storageTab === 'github' && (
              <div className="space-y-4 pt-2 border-t border-zinc-100">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label
                      htmlFor="studio-gh-repo"
                      className="block text-xs font-medium text-zinc-600 mb-1"
                    >
                      Public GitHub Repository (owner/repo)
                    </label>
                    <input
                      id="studio-gh-repo"
                      type="text"
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                      placeholder="username/droidvault-releases"
                      className="w-full px-3.5 py-2 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white"
                    />
                  </div>
                  <div className="flex items-end gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={fetchingGh}
                      onClick={() => void handleFetchGitHub()}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap h-[38px]"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${fetchingGh ? 'animate-spin' : ''}`} />
                      {fetchingGh ? 'Fetching...' : 'Fetch Releases'}
                    </button>
                    <a
                      href={getNewGitHubReleaseUrl(githubRepo)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap h-[38px]"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      New GitHub Release
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {ghError && <p className="text-xs text-red-600">{ghError}</p>}

                {ghReleases.length > 0 && (
                  <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100 max-h-64 overflow-y-auto">
                    {ghReleases.map((rel) => (
                      <div key={rel.id} className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-zinc-900">
                            {rel.name || rel.tag_name}{' '}
                            <span className="font-mono text-zinc-500">({rel.tag_name})</span>
                          </span>
                          <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                            {rel.assets.length} asset(s)
                          </span>
                        </div>
                        {rel.assets.length === 0 ? (
                          <p className="text-xs text-zinc-500">
                            No files attached to this release yet.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {rel.assets.map((asset) => {
                              const isVid = isVideoFileName(asset.name);
                              return (
                                <button
                                  key={asset.id}
                                  type="button"
                                  onClick={() =>
                                    isVid
                                      ? handleImportVideoAsset(asset)
                                      : handleImportApkAsset(rel, asset)
                                  }
                                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-zinc-50 hover:bg-emerald-50 text-zinc-800 hover:text-emerald-800 border border-zinc-200 hover:border-emerald-300 rounded-md transition-colors"
                                >
                                  <span className="font-mono">{asset.name}</span>
                                  <span className="text-zinc-500 tabular-nums">
                                    ({formatBytes(asset.size)})
                                  </span>
                                  <span className="font-semibold text-emerald-700">
                                    {isVid ? 'Use Video' : 'Use APK'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {storageTab === 'cloudinary' && (
              <div className="space-y-4 pt-2 border-t border-zinc-100">
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Configure a free Cloudinary <strong>Unsigned Upload Preset</strong> to upload app icons, screenshots, and MP4 demo videos directly from your browser. Settings are saved locally on your device.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="cloud-name"
                      className="block text-xs font-medium text-zinc-600 mb-1"
                    >
                      Cloudinary Cloud Name
                    </label>
                    <input
                      id="cloud-name"
                      type="text"
                      value={cloudinaryCfg.cloudName}
                      onChange={(e) => {
                        const next = { ...cloudinaryCfg, cloudName: e.target.value };
                        setCloudinaryCfg(next);
                        saveCloudinaryConfig(next);
                      }}
                      placeholder="your-cloud-name"
                      className="w-full px-3.5 py-2 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="upload-preset"
                      className="block text-xs font-medium text-zinc-600 mb-1"
                    >
                      Unsigned Upload Preset Name
                    </label>
                    <input
                      id="upload-preset"
                      type="text"
                      value={cloudinaryCfg.uploadPreset}
                      onChange={(e) => {
                        const next = { ...cloudinaryCfg, uploadPreset: e.target.value };
                        setCloudinaryCfg(next);
                        saveCloudinaryConfig(next);
                      }}
                      placeholder="droidvault_unsigned"
                      className="w-full px-3.5 py-2 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white"
                    />
                  </div>
                </div>
                {cloudinaryReady && (
                  <p className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    Direct uploads enabled for App Icon, Screenshots, and App Video below.
                  </p>
                )}
              </div>
            )}

            {storageTab === 'links' && (
              <div className="pt-2 border-t border-zinc-100 text-xs text-zinc-600 leading-relaxed">
                Paste any Google Drive share link, Dropbox link, Cloudflare R2 public URL, YouTube video URL, or GitHub file link below and click <strong>Convert Link</strong> to generate a direct URL automatically.
              </div>
            )}
          </section>

          {/* Main Split: Release Upload Form + Live Catalog Table */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-zinc-100">
                <h2 className="text-base font-bold text-zinc-950">
                  {editingId
                    ? `Editing Release: ${editingId}`
                    : 'Upload New APK & App Video'}
                </h2>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="text-xs font-medium text-zinc-600 hover:text-zinc-950"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="app-name" className="block text-xs font-medium text-zinc-700 mb-1">
                    App Name *
                  </label>
                  <input
                    id="app-name"
                    required
                    maxLength={120}
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="NoteSync Pro"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label htmlFor="app-id" className="block text-xs font-medium text-zinc-700 mb-1">
                    Release ID *
                  </label>
                  <input
                    id="app-id"
                    required
                    disabled={Boolean(editingId)}
                    maxLength={128}
                    value={form.id}
                    onChange={(e) => updateField('id', e.target.value)}
                    placeholder="notesync-pro"
                    className="w-full px-3 py-2 text-sm font-mono border border-zinc-200 rounded-lg disabled:bg-zinc-100 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="app-tagline" className="block text-xs font-medium text-zinc-700 mb-1">
                  Short Tagline *
                </label>
                <input
                  id="app-tagline"
                  required
                  maxLength={240}
                  value={form.tagline}
                  onChange={(e) => updateField('tagline', e.target.value)}
                  placeholder="Fast offline-first utility built for modern Android devices."
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="app-version" className="block text-xs font-medium text-zinc-700 mb-1">
                    Version *
                  </label>
                  <input
                    id="app-version"
                    required
                    maxLength={40}
                    value={form.version}
                    onChange={(e) => updateField('version', e.target.value)}
                    placeholder="2.4.0"
                    className="w-full px-3 py-2 text-sm font-mono border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label htmlFor="app-category" className="block text-xs font-medium text-zinc-700 mb-1">
                    Category
                  </label>
                  <select
                    id="app-category"
                    value={form.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:border-emerald-600"
                  >
                    {APP_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="app-android" className="block text-xs font-medium text-zinc-700 mb-1">
                    Min Android
                  </label>
                  <input
                    id="app-android"
                    required
                    maxLength={40}
                    value={form.minAndroid}
                    onChange={(e) => updateField('minAndroid', e.target.value)}
                    placeholder="Android 10+"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label htmlFor="app-provider" className="block text-xs font-medium text-zinc-700 mb-1">
                    Storage Host
                  </label>
                  <select
                    id="app-provider"
                    value={form.storageProvider}
                    onChange={(e) =>
                      updateField('storageProvider', e.target.value as StorageProvider)
                    }
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:border-emerald-600"
                  >
                    {Object.entries(STORAGE_PROVIDER_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="app-pkg" className="block text-xs font-medium text-zinc-700 mb-1">
                    Android Package ID *
                  </label>
                  <input
                    id="app-pkg"
                    required
                    maxLength={160}
                    value={form.packageId}
                    onChange={(e) => updateField('packageId', e.target.value)}
                    placeholder="com.studio.myapp"
                    className="w-full px-3 py-2 text-sm font-mono border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label htmlFor="app-dev" className="block text-xs font-medium text-zinc-700 mb-1">
                    Developer / Studio *
                  </label>
                  <input
                    id="app-dev"
                    required
                    maxLength={120}
                    value={form.developer}
                    onChange={(e) => updateField('developer', e.target.value)}
                    placeholder="DroidVault Labs"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* APK Package Section */}
              <div className="pt-4 border-t border-zinc-100 space-y-4">
                <h3 className="text-xs font-semibold text-zinc-900">
                  APK Package Download Link
                </h3>
                <div>
                  <label htmlFor="apk-url" className="block text-xs font-medium text-zinc-700 mb-1">
                    Direct HTTPS APK URL *
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="apk-url"
                      required
                      type="url"
                      value={form.apkUrl}
                      onChange={(e) => updateField('apkUrl', e.target.value)}
                      placeholder="https://github.com/user/repo/releases/download/v1.0.0/app.apk"
                      className="flex-1 px-3 py-2 text-sm font-mono border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleNormalizeUrlField('apkUrl', 'apk')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg whitespace-nowrap shrink-0"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Convert Link
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor="apk-filename" className="block text-xs font-medium text-zinc-700 mb-1">
                      APK File Name *
                    </label>
                    <input
                      id="apk-filename"
                      required
                      maxLength={200}
                      value={form.apkFileName}
                      onChange={(e) => updateField('apkFileName', e.target.value)}
                      placeholder="MyApp-v2.4.0-universal.apk"
                      className="w-full px-3 py-2 text-sm font-mono border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="apk-size" className="block text-xs font-medium text-zinc-700 mb-1">
                      File Size (MB)
                    </label>
                    <input
                      id="apk-size"
                      type="number"
                      min={0}
                      max={2048}
                      step="0.1"
                      value={
                        form.apkSizeBytes
                          ? Number((form.apkSizeBytes / (1024 * 1024)).toFixed(2))
                          : ''
                      }
                      onChange={(e) =>
                        updateField(
                          'apkSizeBytes',
                          Math.round((parseFloat(e.target.value) || 0) * 1024 * 1024)
                        )
                      }
                      placeholder="24.5"
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="apk-sha" className="block text-xs font-medium text-zinc-700 mb-1">
                    SHA-256 Checksum (optional)
                  </label>
                  <input
                    id="apk-sha"
                    maxLength={128}
                    value={form.apkSha256}
                    onChange={(e) => updateField('apkSha256', e.target.value)}
                    placeholder="Optional 64-character SHA-256 hash"
                    className="w-full px-3 py-2 text-xs font-mono border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Dedicated App Video Section */}
              <div className="pt-4 border-t border-zinc-100 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-zinc-900 inline-flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-emerald-600" />
                    App Demo Video (MP4, WebM, YouTube, or Google Drive)
                  </h3>
                  {cloudinaryReady ? (
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer whitespace-nowrap">
                      <CloudUpload className="w-3.5 h-3.5" />
                      {uploadingSlot === 'video' ? 'Uploading Video...' : 'Upload Video (MP4)'}
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/*"
                        className="hidden"
                        onChange={(e) => void handleCloudinaryUpload(e, 'video')}
                      />
                    </label>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setStorageTab('cloudinary');
                        setFeedback({
                          type: 'success',
                          text: 'Enter your Cloudinary Cloud Name and Unsigned Upload Preset above to upload MP4 videos directly from your browser, or import a .mp4 asset from GitHub Releases.',
                        });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg whitespace-nowrap"
                    >
                      <CloudUpload className="w-3.5 h-3.5" />
                      Enable Video Upload
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    id="video-url"
                    value={form.videoUrl}
                    onChange={(e) => updateField('videoUrl', e.target.value)}
                    placeholder="https://... (Direct MP4, GitHub Release .mp4, YouTube, or Google Drive link)"
                    className="flex-1 px-3 py-2 text-xs font-mono border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleNormalizeUrlField('videoUrl', 'video')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg whitespace-nowrap shrink-0"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Convert
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="video-filename"
                    className="block text-xs font-medium text-zinc-600 mb-1"
                  >
                    Video Title / File Name (optional)
                  </label>
                  <input
                    id="video-filename"
                    maxLength={200}
                    value={form.videoFileName}
                    onChange={(e) => updateField('videoFileName', e.target.value)}
                    placeholder="MyApp-walkthrough-demo.mp4"
                    className="w-full px-3 py-2 text-xs font-mono border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>

                {videoPreview.type !== 'none' && (
                  <div className="aspect-video w-full rounded-lg overflow-hidden bg-zinc-950 border border-zinc-200">
                    {videoPreview.type === 'direct' ? (
                      <video
                        src={videoPreview.src}
                        controls
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <iframe
                        src={videoPreview.src}
                        title="App video preview"
                        className="w-full h-full border-0"
                        allowFullScreen
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Icon & Screenshots (up to 4) */}
              <div className="pt-4 border-t border-zinc-100 space-y-4">
                <h3 className="text-xs font-semibold text-zinc-900">
                  App Icon &amp; Screenshots (up to 4)
                </h3>

                <div className="flex items-start gap-3">
                  <AppImage
                    src={form.iconUrl}
                    alt="Icon preview"
                    className="w-12 h-12 rounded-xl object-cover border border-zinc-200 shrink-0 mt-5"
                  />
                  <div className="flex-1 min-w-0">
                    <label htmlFor="icon-url" className="block text-xs font-medium text-zinc-700 mb-1">
                      App Icon URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="icon-url"
                        value={form.iconUrl}
                        onChange={(e) => updateField('iconUrl', e.target.value)}
                        placeholder="https://... or upload via Cloudinary"
                        className="flex-1 px-3 py-2 text-xs font-mono border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                      />
                      {cloudinaryReady && (
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0">
                          <CloudUpload className="w-3.5 h-3.5" />
                          {uploadingSlot === 'icon' ? 'Uploading...' : 'Upload'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => void handleCloudinaryUpload(e, 'icon')}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <div key={idx}>
                      <label
                        htmlFor={`shot-${idx}`}
                        className="block text-xs font-medium text-zinc-600 mb-1"
                      >
                        Screenshot {idx + 1}
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          id={`shot-${idx}`}
                          value={form.screenshots[idx] || ''}
                          onChange={(e) => {
                            const next = [...form.screenshots];
                            while (next.length < 4) next.push('');
                            next[idx] = e.target.value;
                            updateField('screenshots', next);
                          }}
                          placeholder="https://..."
                          className="flex-1 min-w-0 px-3 py-1.5 text-xs font-mono border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                        />
                        {cloudinaryReady && (
                          <label className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg cursor-pointer shrink-0">
                            {uploadingSlot === String(idx) ? (
                              '...'
                            ) : (
                              <CloudUpload className="w-3.5 h-3.5" />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => void handleCloudinaryUpload(e, idx)}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description & Changelog */}
              <div className="pt-4 border-t border-zinc-100 space-y-4">
                <div>
                  <label htmlFor="app-desc" className="block text-xs font-medium text-zinc-700 mb-1">
                    Full Description
                  </label>
                  <textarea
                    id="app-desc"
                    rows={4}
                    maxLength={5000}
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Describe key features, offline capability, and permissions..."
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label htmlFor="app-whatsnew" className="block text-xs font-medium text-zinc-700 mb-1">
                    What&apos;s New / Changelog
                  </label>
                  <textarea
                    id="app-whatsnew"
                    rows={3}
                    maxLength={3000}
                    value={form.whatsNew}
                    onChange={(e) => updateField('whatsNew', e.target.value)}
                    placeholder="• Improved performance&#10;• Android 15 compatibility"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Visibility Toggles + Submit */}
              <div className="pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-5 text-xs font-medium text-zinc-700">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.published}
                      onChange={(e) => updateField('published', e.target.checked)}
                      className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-600"
                    />
                    Published publicly
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.featured}
                      onChange={(e) => updateField('featured', e.target.checked)}
                      className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-600"
                    />
                    Feature on homepage
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                >
                  {saving
                    ? 'Saving...'
                    : editingId
                      ? 'Save Changes'
                      : 'Publish Release'}
                </button>
              </div>
            </form>

            {/* Live Releases List */}
            <section className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-950">
                  Published Releases ({realApps.length})
                </h2>
                <span className="text-xs text-zinc-500">Live synced</span>
              </div>

              {realApps.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-sm font-medium text-zinc-800">
                    No releases saved yet
                  </p>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Import an APK and video from GitHub Releases or fill the form to publish your first Android release.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {realApps.map((app) => (
                    <div key={app.id} className="p-4 flex items-start gap-3.5 hover:bg-zinc-50/70">
                      <AppImage
                        src={app.iconUrl}
                        alt={app.name}
                        className="w-11 h-11 rounded-xl object-cover border border-zinc-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-zinc-950 truncate">
                            {app.name}
                          </p>
                          <span
                            className={`text-[11px] font-semibold whitespace-nowrap ${
                              app.published ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {app.published ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 font-mono tabular-nums mt-0.5 truncate">
                          v{app.version} · {formatBytes(app.apkSizeBytes)}
                          {app.videoUrl ? ' · Video' : ''} ·{' '}
                          {app.downloads.toLocaleString()} dl
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(app)}
                            className="inline-flex items-center gap-1 font-medium text-zinc-700 hover:text-zinc-950"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleTogglePublished(app)}
                            className="font-medium text-zinc-700 hover:text-zinc-950"
                          >
                            {app.published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSetFeatured(app)}
                            className={`inline-flex items-center gap-1 font-medium ${
                              app.featured
                                ? 'text-emerald-700'
                                : 'text-zinc-600 hover:text-zinc-950'
                            }`}
                          >
                            <Star
                              className={`w-3 h-3 ${app.featured ? 'fill-emerald-600' : ''}`}
                            />
                            {app.featured ? 'Featured' : 'Feature'}
                          </button>

                          {confirmDeleteId === app.id ? (
                            <span className="inline-flex items-center gap-2 ml-auto">
                              <button
                                type="button"
                                onClick={() => void handleDeleteApp(app.id)}
                                className="font-semibold text-red-600 hover:text-red-700"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-zinc-500 hover:text-zinc-800"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(app.id)}
                              className="inline-flex items-center gap-1 text-zinc-400 hover:text-red-600 ml-auto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
