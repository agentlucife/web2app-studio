export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      <aside className="w-64 border-r border-gray-800 p-4 hidden md:block">
        <h2 className="text-xl font-bold mb-6">Web2App Studio</h2>
        <nav className="space-y-2 text-sm">
          <a href="/dashboard" className="block px-3 py-2 rounded hover:bg-gray-800">Dashboard</a>
          <a href="/dashboard/projects" className="block px-3 py-2 rounded hover:bg-gray-800">Projects</a>
          <a href="/dashboard/builder" className="block px-3 py-2 rounded hover:bg-gray-800">Builder</a>
          <a href="/dashboard/builds" className="block px-3 py-2 rounded hover:bg-gray-800">Builds</a>
          <a href="/dashboard/github" className="block px-3 py-2 rounded hover:bg-gray-800">GitHub</a>
          <a href="/dashboard/settings" className="block px-3 py-2 rounded hover:bg-gray-800">Settings</a>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
