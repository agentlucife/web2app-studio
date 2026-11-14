import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Web2App Studio</h1>
        <div className="flex gap-4">
          <Link href="/login" className="text-gray-300 hover:text-white">Login</Link>
          <Link href="/dashboard" className="bg-green-600 px-4 py-2 rounded font-semibold">Dashboard</Link>
        </div>
      </nav>

      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h2 className="text-5xl font-extrabold mb-4">
          Turn any website into a <span className="text-green-400">native app</span>
        </h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
          Web2App Studio converts your website into installable Android and iOS applications.
          Powered by GitHub Actions. Free to start.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/login" className="bg-green-600 px-6 py-3 rounded-lg font-semibold hover:bg-green-500">
            Get started
          </Link>
          <Link href="/dashboard" className="border border-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-800">
            Dashboard
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: "Website to App", desc: "Wrap any URL in a native WebView with custom name, icon, and splash." },
          { title: "Native Templates", desc: "Generate Kotlin/Java Android projects and build APKs." },
          { title: "GitHub Powered", desc: "Builds run on GitHub Actions in your own repo. No SDK needed." },
        ].map((c) => (
          <div key={c.title} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-bold mb-2">{c.title}</h3>
            <p className="text-gray-400 text-sm">{c.desc}</p>
          </div>
        ))}
      </section>

      <footer className="text-center text-gray-500 text-sm py-8 border-t border-gray-800">
        Web2App Studio — free & open.
      </footer>
    </div>
  );
}
