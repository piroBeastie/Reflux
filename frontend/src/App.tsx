import { CheckCircle2, Menu, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { ShaderAnimation } from "@/components/ui/shader-lines";
import { NewTestModal } from "@/components/NewTestModal";
import { AppProvider, useApp } from "@/context/AppContext";
import { OverviewTab } from "@/tabs/OverviewTab";
import { ToolsTab } from "@/tabs/ToolsTab";
import { HistoryTab } from "@/tabs/HistoryTab";

const TABS = ["overview", "tools", "history"] as const;
type TabId = (typeof TABS)[number];
const TAB_LABELS: Record<TabId, string> = { overview: "Overview", tools: "Tools", history: "History" };

function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const { error, setError, toast, tools } = useApp();

  const switchTab = (id: TabId) => {
    setActiveTab(id);
    setMenuOpen(false);
  };

  useEffect(() => {
    const openTest = () => setTestModalOpen(true);
    const goOverview = () => setActiveTab("overview");
    const goTools = () => setActiveTab("tools");
    document.addEventListener("open-new-test", openTest);
    document.addEventListener("view-workflow", goOverview);
    document.addEventListener("go-tools", goTools);
    return () => {
      document.removeEventListener("open-new-test", openTest);
      document.removeEventListener("view-workflow", goOverview);
      document.removeEventListener("go-tools", goTools);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white/20 relative overflow-x-hidden">
      <div className="fixed inset-0 z-0">
        <ShaderAnimation />
      </div>
      <div className="fixed inset-0 z-[1] pointer-events-none bg-gradient-to-b from-black/60 via-black/40 to-black/80" />

      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.08]"
        style={{ backdropFilter: "blur(24px) saturate(1.6)", WebkitBackdropFilter: "blur(24px) saturate(1.6)", backgroundColor: "rgba(0,0,0,0.55)" }}
      >
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-white/10 border border-white/10 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white/90" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight text-white/90">Reflux</span>
          </div>

          <div className="hidden md:flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => switchTab(id)}
                className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
                  activeTab === id ? "bg-white/[0.1] text-white shadow-sm" : "text-white/60 hover:text-white/70"
                }`}
              >
                {TAB_LABELS[id]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative hidden md:block group">
              <button
                type="button"
                onClick={() => tools.length > 0 && setTestModalOpen(true)}
                disabled={tools.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-semibold bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                New Test
              </button>
              {tools.length === 0 && (
                <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-white/70 bg-black/80 border border-white/10 rounded-md px-2.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Load MCP tools first
                </span>
              )}
            </div>
            <button type="button" className="md:hidden p-1.5 rounded-lg hover:bg-white/10" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-5 h-5 text-white/80" /> : <Menu className="w-5 h-5 text-white/80" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-white/[0.06] px-4 py-3 space-y-1" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => switchTab(id)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === id ? "bg-white/[0.1] text-white" : "text-white/60"
                }`}
              >
                {TAB_LABELS[id]}
              </button>
            ))}
            <div className="pt-3">
              <button
                type="button"
                onClick={() => { if (tools.length > 0) { setTestModalOpen(true); setMenuOpen(false); } }}
                disabled={tools.length === 0}
                className="w-full py-2 rounded-lg text-xs font-semibold bg-white text-black disabled:opacity-40"
              >
                {tools.length === 0 ? "Load MCP tools first" : "New Test"}
              </button>
            </div>
          </div>
        )}
      </nav>

      {error && (
        <div className="fixed top-16 left-0 right-0 z-[60] px-4">
          <div className="max-w-[1440px] mx-auto bg-red-500/10 border border-red-400/30 rounded-lg px-4 py-2 flex justify-between items-center text-sm text-red-200">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-red-300/60 hover:text-red-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-400/30 rounded-lg px-4 py-2.5 text-sm text-emerald-200 shadow-lg"
               style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
            <CheckCircle2 className="w-4 h-4 text-emerald-400/80 shrink-0" />
            <span>{toast}</span>
          </div>
        </div>
      )}

      <div className="relative z-10 pt-20 md:pt-28 pb-10 md:pb-16 px-4 md:px-8 max-w-[1440px] mx-auto">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "tools" && <ToolsTab />}
        {activeTab === "history" && <HistoryTab />}
      </div>

      <NewTestModal open={testModalOpen} onClose={() => setTestModalOpen(false)} onComplete={() => setActiveTab("overview")} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
