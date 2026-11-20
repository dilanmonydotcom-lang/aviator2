import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ArrowRight,
  Download,
  Film,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AdminStudio } from './components/AdminStudio';
import { AppDetailView } from './components/AppDetailView';
import { AppImage } from './components/AppImage';
import { AuthModal } from './components/AuthModal';
import { MyDownloadsView } from './components/MyDownloadsView';
import { Navbar, type ActivePage } from './components/Navbar';
import { useAuth } from './context/AuthContext';
import { db } from './lib/firebase';
import { HERO_SHOWCASE_IMAGE, STARTER_SAMPLE_APPS } from './lib/seedData';
import { formatBytes } from './lib/storage';
import {
  APP_CATEGORIES,
  type AppRelease,
  type StorageProvider,
} from './types/app';

function parseHashRoute(): { page: ActivePage; appId: string | null } {
  const raw = window.location.hash.replace(/^#/, '');
  if (raw.startsWith('app/')) {
    return { page: 'detail', appId: decodeURIComponent(raw.slice(4)) };
  }
  if (raw === 'downloads') return { page: 'downloads', appId: null };
  if (raw === 'admin') return { page: 'admin', appId: null };
  return { page: 'catalog', appId: null };
}

export default function App() {
  const {
    user,
    authReady,
    isAdminUnlocked,
    isVerifiedBootstrappedAdmin,
    authError,
    clearAuthError,
  } = useAuth();

  const [activePage, setActivePage] = useState<ActivePage>(
    () => parseHashRoute().page
  );
  const [selectedAppId, setSelectedAppId] = useState<string | null>(
    () => parseHashRoute().appId
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [firestoreApps, setFirestoreApps] = useState<AppRelease[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync URL hash for GitHub Pages refresh safety
  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHashRoute();
      setActivePage(parsed.page);
      setSelectedAppId(parsed.appId);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateTo = (
    page: ActivePage,
    appId?: string,
    justUnlockedAdmin = false
  ) => {
    if (page === 'admin' && !isAdminUnlocked && !justUnlockedAdmin) {
      setActivePage('catalog');
      window.location.hash = 'catalog';
      return;
    }
    setActivePage(page);
    if (page === 'detail' && appId) {
      setSelectedAppId(appId);
      window.location.hash = `app/${encodeURIComponent(appId)}`;
    } else {
      setSelectedAppId(null);
      window.location.hash = page === 'catalog' ? 'catalog' : page;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Subscribe to Firestore /apps catalog
  useEffect(() => {
    if (!authReady) return;

    setLoadingApps(true);
    const appsRef = collection(db, 'apps');
    const appsQuery =
      isAdminUnlocked && isVerifiedBootstrappedAdmin
        ? query(appsRef)
        : query(appsRef, where('published', '==', true));

    const unsubscribe = onSnapshot(
      appsQuery,
      (snapshot) => {
        const docs: AppRelease[] = snapshot.docs.map((d) => {
          const data = d.data();
          const rawProvider = String(data.storageProvider || 'github-releases');
          const storageProvider: StorageProvider =
            rawProvider === 'github-releases' ||
            rawProvider === 'cloudinary' ||
            rawProvider === 'cloud-link' ||
            rawProvider === 'google-drive'
              ? rawProvider
              : 'cloud-link';

          return {
            id: String(data.id || d.id),
            name: String(data.name || ''),
            tagline: String(data.tagline || ''),
            description: String(data.description || ''),
            whatsNew: String(data.whatsNew || ''),
            version: String(data.version || '1.0.0'),
            packageId: String(data.packageId || ''),
            category: String(data.category || 'Utilities'),
            minAndroid: String(data.minAndroid || 'Android 10+'),
            developer: String(data.developer || 'DroidVault'),
            iconUrl: String(data.iconUrl || ''),
            apkUrl: String(data.apkUrl || ''),
            apkFileName: String(data.apkFileName || 'app.apk'),
            apkSizeBytes: Number(data.apkSizeBytes || 0),
            apkSha256: String(data.apkSha256 || ''),
            screenshots: Array.isArray(data.screenshots)
              ? data.screenshots.map(String).slice(0, 4)
              : [],
            videoUrl: String(data.videoUrl || ''),
            videoFileName: String(data.videoFileName || ''),
            downloads: Number(data.downloads || 0),
            featured: Boolean(data.featured),
            published: Boolean(data.published),
            storageProvider,
            githubRepo: data.githubRepo ? String(data.githubRepo) : undefined,
            ownerUid: String(data.ownerUid || ''),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });

        docs.sort((a, b) => {
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          return b.downloads - a.downloads;
        });

        setFirestoreApps(docs);
        setLoadingApps(false);
      },
      (error) => {
        // Never throw inside a listener: show the starter catalog instead
        // of crashing the whole page.
        console.error('Firestore apps listener failed:', error);
        setLoadingApps(false);
      }
    );

    // Safety net: never leave skeleton cards on screen forever
    // (blocked network, ad-blocker, offline, etc.).
    const loadingTimer = window.setTimeout(() => setLoadingApps(false), 6000);

    return () => {
      window.clearTimeout(loadingTimer);
      unsubscribe();
    };
  }, [authReady, isAdminUnlocked, isVerifiedBootstrappedAdmin]);

  const hasFirestoreApps = firestoreApps.length > 0;

  const publicApps = useMemo(() => {
    const publishedLive = firestoreApps.filter((a) => a.published);
    if (publishedLive.length > 0) return publishedLive;
    if (!hasFirestoreApps) return STARTER_SAMPLE_APPS;
    return [];
  }, [firestoreApps, hasFirestoreApps]);

  const featuredApp = useMemo(
    () => publicApps.find((a) => a.featured) || publicApps[0] || null,
    [publicApps]
  );

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return publicApps.filter((app) => {
      const catOk =
        selectedCategory === 'All' || app.category === selectedCategory;
      if (!catOk) return false;
      if (!q) return true;
      return (
        app.name.toLowerCase().includes(q) ||
        app.tagline.toLowerCase().includes(q) ||
        app.packageId.toLowerCase().includes(q) ||
        app.developer.toLowerCase().includes(q)
      );
    });
  }, [publicApps, selectedCategory, searchQuery]);

  const selectedApp = useMemo(() => {
    if (!selectedAppId) return null;
    return (
      firestoreApps.find((a) => a.id === selectedAppId) ||
      publicApps.find((a) => a.id === selectedAppId) ||
      null
    );
  }, [selectedAppId, firestoreApps, publicApps]);

  const totalDownloads = useMemo(
    () => publicApps.reduce((sum, a) => sum + (a.downloads || 0), 0),
    [publicApps]
  );

  const videoCount = useMemo(
    () => publicApps.filter((a) => Boolean(a.videoUrl)).length,
    [publicApps]
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3500);
  };

  const handleDownloadApk = async (app: AppRelease) => {
    setDownloadingId(app.id);
    try {
      const link = document.createElement('a');
      link.href = app.apkUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = app.apkFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (!app.isPreviewSample && user) {
        try {
          await updateDoc(doc(db, 'apps', app.id), {
            downloads: increment(1),
          });
          const recordId = `${app.id}-${Date.now()}`.slice(0, 128);
          await setDoc(doc(db, 'users', user.uid, 'downloads', recordId), {
            userId: user.uid,
            appId: app.id,
            appName: app.name.slice(0, 120),
            version: app.version.slice(0, 40),
            downloadedAt: serverTimestamp(),
          });
        } catch (err) {
          console.error('Download counter update skipped:', err);
        }
      }
      showToast(`Starting download for ${app.apkFileName}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const effectivePage: ActivePage =
    activePage === 'admin' && !isAdminUnlocked ? 'catalog' : activePage;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-zinc-950">
      <Navbar
        activePage={effectivePage}
        onNavigate={(page) => navigateTo(page)}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={({ adminUnlocked }) => {
          if (adminUnlocked) {
            navigateTo('admin', undefined, true);
          }
        }}
      />

      {authError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-start justify-between gap-4 text-xs sm:text-sm text-red-800">
            <p className="leading-relaxed">{authError}</p>
            <button
              type="button"
              aria-label="Dismiss authentication message"
              onClick={clearAuthError}
              className="p-1 text-red-600 hover:text-red-900 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 bg-zinc-950 text-white text-xs font-medium px-4 py-3 rounded-lg shadow-lg border border-zinc-800"
        >
          {toastMessage}
        </div>
      )}

      <main className="flex-1">
        {effectivePage === 'detail' && selectedApp ? (
          <AppDetailView
            key={selectedApp.id}
            app={selectedApp}
            downloading={downloadingId === selectedApp.id}
            onBack={() => navigateTo('catalog')}
            onDownload={handleDownloadApk}
          />
        ) : effectivePage === 'downloads' ? (
          <MyDownloadsView
            apps={publicApps}
            onSelectApp={(app) => navigateTo('detail', app.id)}
            onBrowseCatalog={() => navigateTo('catalog')}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        ) : effectivePage === 'admin' && isAdminUnlocked ? (
          <AdminStudio apps={firestoreApps} hasFirestoreApps={hasFirestoreApps} />
        ) : (
          /* Public Storefront Catalog — 100% English, Zero Admin Traces */
          <div>
            {/* Section 1: Balanced 2-Column Storefront Hero */}
            <section className="bg-white border-b border-zinc-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
                  <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                    <div className="text-xs font-medium text-zinc-500 flex flex-wrap items-center gap-2">
                      <span className="text-emerald-700 font-semibold">
                        Verified Android Releases
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Direct APK Downloads</span>
                      <span aria-hidden="true">·</span>
                      <span>Video Previews</span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-950 leading-[1.08] text-balance">
                      Clean Android apps, ready for direct download.
                    </h1>

                    <p className="text-base text-zinc-600 leading-relaxed max-w-xl">
                      Explore curated Android builds with full app walkthrough videos, high-resolution screenshots, release changelogs, and SHA-256 package verification.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <a
                        href="#catalog-grid"
                        className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Browse Apps
                        <ArrowRight className="w-4 h-4" />
                      </a>
                      {!user && (
                        <button
                          type="button"
                          onClick={() => setAuthModalOpen(true)}
                          className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200/80 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Sign In
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-6">
                    <div className="h-full min-h-[260px] lg:min-h-[360px] rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100">
                      <AppImage
                        src={HERO_SHOWCASE_IMAGE}
                        alt="Android smartphone showcasing DroidVault applications"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                {/* Full-Width 4-Column Storefront Summary Strip */}
                <div className="mt-10 pt-8 border-t border-zinc-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <p className="text-xs text-zinc-500">Available Apps</p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-zinc-950 mt-1">
                      {publicApps.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Total Downloads</p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-zinc-950 mt-1">
                      {totalDownloads.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Video Walkthroughs</p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-zinc-950 mt-1">
                      {videoCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Package Integrity</p>
                    <p className="text-lg sm:text-xl font-bold text-zinc-950 mt-1.5">
                      SHA-256 Verified
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Featured Release Spotlight */}
            {featuredApp && (
              <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
                <div className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-start sm:items-center gap-5 min-w-0">
                    <AppImage
                      src={featuredApp.iconUrl}
                      alt={`${featuredApp.name} icon`}
                      fallbackLabel={featuredApp.name.slice(0, 2).toUpperCase()}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-zinc-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mb-1">
                        <span className="font-semibold text-emerald-700">
                          Featured Release
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{featuredApp.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          v{featuredApp.version}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {formatBytes(featuredApp.apkSizeBytes)}
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight truncate">
                        {featuredApp.name}
                      </h2>
                      <p className="text-sm text-zinc-600 mt-1 max-w-2xl line-clamp-2">
                        {featuredApp.tagline}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigateTo('detail', featuredApp.id)}
                      className="px-4 py-2.5 text-sm font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200/80 rounded-lg transition-colors whitespace-nowrap"
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      disabled={downloadingId === featuredApp.id}
                      onClick={() => void handleDownloadApk(featuredApp)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" />
                      Download APK
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Section 3: Filterable Android App Catalog */}
            <section
              id="catalog-grid"
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
                    Release Catalog
                  </h2>
                  <p className="text-sm text-zinc-500 mt-0.5">
                    Select any app to watch its preview video, inspect screenshots, and download the APK.
                  </p>
                </div>

                {/* Live Search */}
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search apps or package ID..."
                    className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Interactive Segmented Category Filter Bar */}
              <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg overflow-x-auto max-w-full">
                {APP_CATEGORIES.map((category) => {
                  const active = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-white text-zinc-950 shadow-sm'
                          : 'text-zinc-600 hover:text-zinc-950'
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>

              {/* Catalog Grid */}
              {loadingApps ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-56 bg-white border border-zinc-200 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredApps.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center space-y-3">
                  <p className="text-base font-semibold text-zinc-950">
                    No matching apps found
                  </p>
                  <p className="text-sm text-zinc-500">
                    Try clearing your search query or switching back to All categories.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredApps.map((app) => (
                    <article
                      key={app.id}
                      onClick={() => navigateTo('detail', app.id)}
                      className="group bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl p-6 flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer"
                    >
                      <div>
                        <div className="flex items-start gap-4">
                          <AppImage
                            src={app.iconUrl}
                            alt={`${app.name} icon`}
                            fallbackLabel={app.name.slice(0, 2).toUpperCase()}
                            className="w-14 h-14 rounded-xl object-cover border border-zinc-200 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-zinc-500 truncate">
                              {app.category} · {app.developer}
                            </p>
                            <h3 className="text-base font-bold text-zinc-950 group-hover:text-emerald-700 transition-colors truncate mt-0.5">
                              {app.name}
                            </h3>
                            <p className="text-xs font-mono tabular-nums text-zinc-500 mt-1">
                              v{app.version} · {formatBytes(app.apkSizeBytes)} ·{' '}
                              {app.minAndroid}
                            </p>
                          </div>
                        </div>

                        <p className="text-sm text-zinc-600 leading-relaxed mt-4 line-clamp-2">
                          {app.tagline}
                        </p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between gap-3">
                        <div className="text-xs text-zinc-500 flex items-center gap-2 min-w-0 truncate">
                          {app.videoUrl ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <Film className="w-3.5 h-3.5 shrink-0" />
                              Video preview
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 truncate">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              Verified APK
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDownloadApk(app);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Quiet Public Footer — Zero Admin or Hosting Traces */}
      <footer className="bg-white border-t border-zinc-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} DroidVault — Android App Hub</p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => navigateTo('catalog')}
              className="hover:text-zinc-950 transition-colors"
            >
              Catalog
            </button>
            <button
              type="button"
              onClick={() => navigateTo('downloads')}
              className="hover:text-zinc-950 transition-colors"
            >
              My Downloads
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
