export default function Navbar() {
    return (
        <header className="w-full fixed top-0 z-50 border-b border-white/5 bg-[#0F1218]/60 backdrop-blur">
            <nav className="max-w-7xl mx-auto h-16 px-4 flex items-center justify-between">
                <div className="font-semibold tracking-tight">obonelli.dev</div>
                <div className="flex items-center gap-2">
                    <a href="/docs" className="px-3 py-1.5 text-sm text-white/80 hover:text-white">Docs</a>
                    <a href="/login" className="neon-btn px-4 py-2 text-sm font-medium cursor-pointer">Sign in</a>
                </div>
            </nav>
        </header>
    );
}
