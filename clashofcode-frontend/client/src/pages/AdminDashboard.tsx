/**
 * Admin Dashboard — FR-14.1, FR-14.2
 * Moderation and trust-ops dashboard for administrators.
 * Accessible only to users with role=admin.
 */
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Shield, Trophy, Users, Book, Plus, CheckCircle, XCircle } from "lucide-react";

interface Problem { id: string; title: string; difficulty: string; isDraft: boolean; }
interface Tournament { id: string; name: string; status: string; participantCount?: number; }

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tab, setTab] = useState<"problems" | "tournaments">("problems");
  const [loading, setLoading] = useState(true);
  const [newTournament, setNewTournament] = useState({ name: "", maxParticipants: 16, format: "single_elimination" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Redirect non-admins
    if (user && (user as any).role !== "admin") {
      setLocation("/app");
    }
  }, [user]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pRes, tRes] = await Promise.all([
          api.get("/problems?limit=50"),
          api.get("/tournaments"),
        ]);
        setProblems(pRes.data?.items || []);
        setTournaments(tRes.data || []);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const publishProblem = async (id: string) => {
    await api.put(`/admin/problems/${id}`, { isDraft: false });
    setProblems(prev => prev.map(p => p.id === id ? { ...p, isDraft: false } : p));
  };

  const draftProblem = async (id: string) => {
    await api.put(`/admin/problems/${id}`, { isDraft: true });
    setProblems(prev => prev.map(p => p.id === id ? { ...p, isDraft: true } : p));
  };

  const createTournament = async () => {
    if (!newTournament.name.trim()) return;
    setCreating(true);
    try {
      const res = await api.post("/tournaments", newTournament);
      setTournaments(prev => [res.data, ...prev]);
      setNewTournament({ name: "", maxParticipants: 16, format: "single_elimination" });
    } catch { /* ignore */ }
    setCreating(false);
  };

  const updateTournamentStatus = async (id: string, status: string) => {
    await api.patch(`/tournaments/${id}`, { status });
    setTournaments(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const statusBadgeClass: Record<string, string> = {
    upcoming: "bg-blue-900/40 text-blue-400",
    registration: "bg-amber-900/40 text-amber-400",
    active: "bg-emerald-900/40 text-emerald-400",
    completed: "bg-slate-700/40 text-slate-400",
    cancelled: "bg-red-900/40 text-red-400",
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
          <Shield className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-sm text-[#848792]">Moderation & Trust-Ops</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { icon: Book, label: "Problems", value: problems.length, sub: `${problems.filter(p => p.isDraft).length} drafts` },
          { icon: Trophy, label: "Tournaments", value: tournaments.length, sub: `${tournaments.filter(t => t.status === "active").length} active` },
          { icon: Users, label: "Admin Role", value: "Active", sub: user?.handle || "" },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 mb-1 text-[#848792] text-sm">{<Icon className="h-4 w-4" />}{label}</div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-[#848792] mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["problems", "tournaments"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white/10 text-white border border-white/20" : "text-[#848792] hover:text-white"}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-[#848792] text-center py-16">Loading…</div>
      ) : tab === "problems" ? (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-[#848792]">
              <tr>
                <th className="text-left p-4">Title</th>
                <th className="text-left p-4">Difficulty</th>
                <th className="text-left p-4">Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {problems.map(p => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 font-medium">{p.title}</td>
                  <td className="p-4 text-[#848792] capitalize">{p.difficulty}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${p.isDraft ? "bg-amber-900/40 text-amber-400" : "bg-emerald-900/40 text-emerald-400"}`}>
                      {p.isDraft ? "Draft" : "Published"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {p.isDraft ? (
                      <button onClick={() => publishProblem(p.id)} className="flex items-center gap-1 ml-auto text-emerald-400 hover:text-emerald-300 text-xs">
                        <CheckCircle className="h-4 w-4" /> Publish
                      </button>
                    ) : (
                      <button onClick={() => draftProblem(p.id)} className="flex items-center gap-1 ml-auto text-amber-400 hover:text-amber-300 text-xs">
                        <XCircle className="h-4 w-4" /> Unpublish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Create tournament */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold text-[#848792] mb-3 flex items-center gap-2"><Plus className="h-4 w-4" />New Tournament</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Tournament name…"
                value={newTournament.name}
                onChange={e => setNewTournament(p => ({ ...p, name: e.target.value }))}
                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#848792] outline-none focus:border-white/30"
              />
              <select
                value={newTournament.format}
                onChange={e => setNewTournament(p => ({ ...p, format: e.target.value }))}
                className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
              >
                <option value="single_elimination">Single Elimination</option>
                <option value="swiss">Swiss</option>
              </select>
              <button
                onClick={createTournament}
                disabled={creating}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>

          {/* Tournament list */}
          {tournaments.map(t => (
            <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-[#848792] mt-1">{t.participantCount ?? 0} participants</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs ${statusBadgeClass[t.status] || "bg-slate-700/40 text-slate-400"}`}>{t.status}</span>
                <select
                  value={t.status}
                  onChange={e => updateTournamentStatus(t.id, e.target.value)}
                  className="bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none"
                >
                  {["upcoming","registration","active","completed","cancelled"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
