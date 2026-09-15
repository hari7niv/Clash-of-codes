/**
 * Notifications page — FR-13.1
 */
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { MatchLine } from "@/components/ArenaPrimitives";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  friend_request: "👥",
  challenge_invite: "⚔️",
  quest_complete: "✅",
  match_result: "🏆",
  system: "📢",
};

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/notifications${filter === "unread" ? "?unreadOnly=true" : ""}?limit=50`);
      setNotifications(res.data?.items || []);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch { setNotifications([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await api.patch("/notifications/read-all").catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const deleteNotif = async (id: string, wasUnread: boolean) => {
    await api.delete(`/notifications/${id}`).catch(() => {});
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
  };

  return (
    <div className="page-wrap enter-up">
      <header>
        <MatchLine label="Updates / notifications" />
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-[-.07em] sm:text-5xl">Notifications</h1>
            <p className="mt-2 text-sm text-[#989ba5]">{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="secondary-button flex items-center gap-2 text-xs">
              <CheckCheck className="h-4 w-4" /> Mark all read
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="mt-7 flex gap-2">
        {(["all", "unread"] as const).map(t => (
          <button key={t} onClick={() => setFilter(t)} className={`topic-button ${filter === t ? "is-selected" : ""}`}>
            {t === "all" ? "All" : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="flex justify-center py-16 text-[#848792]">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Bell className="h-10 w-10 text-[#333540]" />
            <p className="text-[#848792]">No notifications here.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[.06] rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            {notifications.map(n => (
              <div
                key={n.id}
                className={`flex items-start gap-4 px-5 py-4 transition-colors ${!n.read ? "bg-white/[.03]" : ""}`}
              >
                <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded border border-white/10 bg-white/[.04] text-lg">
                  {TYPE_ICONS[n.type] || "🔔"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${n.read ? "text-[#c8cad0]" : "text-white"}`}>{n.title}</p>
                    {!n.read && <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#f04432]" />}
                  </div>
                  <p className="mt-0.5 text-xs text-[#848792]">{n.body}</p>
                  <p className="mt-1 font-mono text-[10px] text-[#5e6170]">
                    {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-none ml-2">
                  {!n.read && (
                    <button onClick={() => markRead(n.id)} title="Mark read" className="icon-button h-8 w-8 text-[#848792] hover:text-[#b5df73]">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => deleteNotif(n.id, !n.read)} title="Delete" className="icon-button h-8 w-8 text-[#848792] hover:text-[#e48b87]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
