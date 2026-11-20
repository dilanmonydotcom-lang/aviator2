import { useState } from 'react';
import { Check, CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import { FIREBASE_PROJECT_ID } from '../lib/firebase';
import { loadSavedGitHubRepo, normalizeRepoSlug, saveGitHubRepo } from '../lib/storage';

export function GitHubPublishGuide() {
  const [repoInput, setRepoInput] = useState(
    () => loadSavedGitHubRepo() || 'your-username/droidvault'
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const normalized = normalizeRepoSlug(repoInput) || 'your-username/droidvault';
  const [owner = 'your-username', repo = 'droidvault'] = normalized.split('/');
  const pagesHost = `${owner}.github.io`;
  const pagesUrl = `https://${pagesHost}/${repo}/`;

  const gitCommands = `git init
git add .
git commit -m "Deploy DroidVault to GitHub Pages"
git branch -M main
git remote add origin https://github.com/${owner}/${repo}.git
git push -u origin main`;

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore restricted clipboard errors
    }
  };

  const handleRepoChange = (val: string) => {
    setRepoInput(val);
    saveGitHubRepo(val);
  };

  const readyItems = [
    {
      title: 'Static Vite Build (base: "./")',
      description:
        'Relative asset base ensures all bundles and images resolve cleanly on GitHub Pages subpaths.',
    },
    {
      title: 'Zero Backend Server Required',
      description:
        'Catalog, authentication, APK links, and video uploads operate 100% client-side.',
    },
    {
      title: 'GitHub Actions Auto-Deploy Workflow',
      description:
        'Included .github/workflows/deploy.yml automatically builds dist/ and publishes on push to main.',
    },
    {
      title: 'SPA Hash Routing + 404.html + .nojekyll',
      description:
        'Prevents GitHub Pages 404 errors when refreshing or sharing direct app links.',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Storage Stack Summary */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-zinc-950">
          Recommended Static Storage Stack
        </h2>
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                  <th className="py-3 px-4">Asset Type</th>
                  <th className="py-3 px-4">Storage Provider</th>
                  <th className="py-3 px-4">Free Limit</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-zinc-950">
                    Android APK &amp; Video Files
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-emerald-700">
                    GitHub Releases
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-zinc-700">
                    2 GB / file · Unlimited CDN
                  </td>
                  <td className="py-3.5 px-4 text-zinc-600 text-xs">
                    Upload .apk and .mp4 files in GitHub Releases and auto-import them in one click.
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-zinc-950">
                    Icons, Screenshots &amp; Demo Videos
                  </td>
                  <td className="py-3.5 px-4 font-medium text-zinc-900">
                    Cloudinary (Unsigned Upload)
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-zinc-700">
                    25 free credits / mo
                  </td>
                  <td className="py-3.5 px-4 text-zinc-600 text-xs">
                    Direct browser upload without any backend server. YouTube and Google Drive links also supported.
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-zinc-950">
                    App Catalog &amp; Accounts
                  </td>
                  <td className="py-3.5 px-4 font-medium text-zinc-900">
                    Firebase Firestore + Auth
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-zinc-700">
                    Spark Free Tier
                  </td>
                  <td className="py-3.5 px-4 text-zinc-600 text-xs">
                    Real-time catalog updates protected by Firestore Security Rules.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pre-configured Checklist */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {readyItems.map((item) => (
          <div
            key={item.title}
            className="bg-white border border-zinc-200 rounded-xl p-4 flex items-start gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-950">{item.title}</h3>
              <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* Deployment Generator */}
      <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6">
        <div>
          <label
            htmlFor="gh-repo-slug"
            className="block text-xs font-semibold text-zinc-700 mb-1.5"
          >
            Your GitHub Repository (owner/repo)
          </label>
          <input
            id="gh-repo-slug"
            type="text"
            value={repoInput}
            onChange={(e) => handleRepoChange(e.target.value)}
            placeholder="username/droidvault"
            className="w-full max-w-md px-3.5 py-2 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white"
          />
          <p className="text-xs text-zinc-500 mt-2">
            Live GitHub Pages URL: <span className="font-mono text-zinc-900">{pagesUrl}</span>
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-semibold text-zinc-900">
              1. Push repository to GitHub
            </p>
            <button
              type="button"
              onClick={() => void handleCopy('git', gitCommands)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800"
            >
              {copiedId === 'git' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy commands
                </>
              )}
            </button>
          </div>
          <pre className="p-4 rounded-lg bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto leading-relaxed">
            {gitCommands}
          </pre>
        </div>

        <div className="pt-4 border-t border-zinc-100 space-y-2">
          <p className="text-xs font-semibold text-zinc-900">
            2. Enable GitHub Pages (GitHub Actions)
          </p>
          <p className="text-xs text-zinc-600">
            In GitHub, open Settings → Pages → Build and deployment → Source → select GitHub Actions.
          </p>
        </div>

        <div className="pt-4 border-t border-zinc-100 space-y-2.5">
          <p className="text-xs font-semibold text-zinc-900">
            3. Enable Email/Password Auth &amp; Authorize GitHub Domain in Firebase
          </p>
          <p className="text-xs text-zinc-600 leading-relaxed">
            In Firebase Console → Authentication: enable the <strong>Email/Password</strong> sign-in provider, and add your GitHub Pages domain under <strong>Settings → Authorized domains</strong>:
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="px-3 py-2 rounded-lg bg-zinc-100 border border-zinc-200 font-mono text-xs text-zinc-900">
              {pagesHost}
            </code>
            <button
              type="button"
              onClick={() => void handleCopy('domain', pagesHost)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-800 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg transition-colors"
            >
              {copiedId === 'domain' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Domain
                </>
              )}
            </button>
            <a
              href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              Open Firebase Auth Console
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
