/**
 * Style system: ClashOfCode Tournament Console — a tactical settings workspace with a compact
 * navigation column and restrained configuration panels, adapted from the supplied reference.
 */
import { Avatar } from "@/components/ArenaPrimitives";
import {
  BellRing,
  Check,
  ChevronRight,
  Eye,
  LayoutPanelTop,
  LockKeyhole,
  MonitorCog,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Swords,
  UserRound,
} from "lucide-react";
import { type ReactNode, useState, useEffect } from "react";
import { toast } from "sonner";
import { useSettingsData } from "@/hooks/useSettingsData";

type SettingsTab = "profile" | "match" | "interface" | "notifications" | "account";

const settingsTabs: Array<{ id: SettingsTab; label: string; icon: typeof UserRound; note: string }> = [
  { id: "profile", label: "Public profile", icon: UserRound, note: "Identity & visibility" },
  { id: "match", label: "Match preferences", icon: Swords, note: "Queue & arena defaults" },
  { id: "interface", label: "Competition desk", icon: LayoutPanelTop, note: "Display & motion" },
  { id: "notifications", label: "Notifications", icon: BellRing, note: "Match alerts" },
  { id: "account", label: "Account & privacy", icon: LockKeyhole, note: "Security & data" },
];

function Toggle({ enabled, onClick, title, copy }: { enabled: boolean; onClick: () => void; title: string; copy: string }) {
  return (
    <div className="settings-toggle-row">
      <div>
        <p>{title}</p>
        <span>{copy}</span>
      </div>
      <button type="button" aria-pressed={enabled} onClick={onClick} className={`settings-toggle ${enabled ? "is-on" : ""}`}>
        <span />
      </button>
    </div>
  );
}

function PanelHeader({ kicker, title, copy, status, icon: Icon }: { kicker: string; title: string; copy: string; status: string; icon: typeof Eye }) {
  return (
    <div className="settings-panel-head">
      <div>
        <p className="settings-matchline"><i /> {kicker}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      <span className="settings-status"><Icon className="h-3.5 w-3.5" /> {status}</span>
    </div>
  );
}

export default function Settings() {
  const { player, loading, updateProfile } = useSettingsData();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [search, setSearch] = useState("");
  const [deskMode, setDeskMode] = useState<"standard" | "compact">("standard");
  const [profile, setProfile] = useState({
    handle: "Loading...",
    bio: "Working through hard problems, one clean solution at a time.",
    location: "Bengaluru, India",
  });
  
  useEffect(() => {
    if (player) {
      setProfile(prev => ({ ...prev, handle: player.handle }));
    }
  }, [player]);
  const [preferences, setPreferences] = useState({
    ratingVisible: true,
    activityVisible: true,
    quickQueue: true,
    reducedMotion: false,
    matchFound: true,
    directInvites: true,
    weeklyReview: false,
    discoverable: true,
  });

  const activeMeta = settingsTabs.find((item) => item.id === activeTab)!;
  const visibleTabs = settingsTabs.filter((item) => `${item.label} ${item.note}`.toLowerCase().includes(search.toLowerCase()));
  const toggle = (key: keyof typeof preferences) => setPreferences((current) => ({ ...current, [key]: !current[key] }));
  const save = () => toast.success(`${activeMeta.label} saved`);

  const profilePanel = (
    <>
      <PanelHeader kicker="Identity channel / season 03" title="Public profile" copy="Define the player signal shown in rooms, bracket cards, and post-battle history." status="Public" icon={Eye} />
      <div className="settings-profile-intro">
        <Avatar initials={player?.initials || "ME"} tone="red" size="lg" />
        <div className="settings-player-name">
          <p className="font-display text-xl font-bold tracking-[-.05em]">{player?.handle || "Loading..."}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[.11em] text-[#a7aaaf]">{player?.rating || 1500} rating / {player?.rank || "Bronze"}</p>
          <button type="button" onClick={() => toast("Avatar changes are ready for backend storage")} className="settings-inline-action">Change identity mark</button>
        </div>
        <div className="settings-profile-statblocks" aria-label="Player identity signals">
          <div><small>Rating</small><strong>{player?.rating || 1500}</strong></div>
          <div><small>Rank</small><strong>{player?.rank?.toUpperCase() || "BRONZE"}</strong></div>
          <div><small>Signal</small><strong>OPEN</strong></div>
        </div>
      </div>
      <div className="settings-field-grid">
        <label className="settings-field">Display name<input value={profile.handle} onChange={(event) => setProfile((current) => ({ ...current, handle: event.target.value }))} className="console-input" /></label>
        <label className="settings-field">Location<input value={profile.location} onChange={(event) => setProfile((current) => ({ ...current, location: event.target.value }))} className="console-input" /></label>
        <label className="settings-field settings-field-wide">Short bio<textarea value={profile.bio} onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))} className="console-input min-h-28 resize-y leading-6" /></label>
      </div>
      <div className="settings-divider" />
      <div className="settings-list">
        <Toggle enabled={preferences.ratingVisible} onClick={() => toggle("ratingVisible")} title="Show rating on profile" copy="Display your current rating beside public match history." />
        <Toggle enabled={preferences.activityVisible} onClick={() => toggle("activityVisible")} title="Show activity signal" copy="Let room hosts see whether you are actively available." />
      </div>
    </>
  );

  const matchPanel = (
    <>
      <PanelHeader kicker="Arena defaults / queue protocol" title="Match preferences" copy="Set the defaults that appear whenever you open the matchmaking desk." status="Ranked" icon={Swords} />
      <div className="settings-field-grid">
        <label className="settings-field">Default queue<select className="console-input" defaultValue="Ranked 1v1"><option>Ranked 1v1</option><option>Practice solo</option><option>Private arena</option></select></label>
        <label className="settings-field">Preferred tempo<select className="console-input" defaultValue="10:00 Standard"><option>05:00 Blitz</option><option>10:00 Standard</option><option>20:00 Deep battle</option></select></label>
        <label className="settings-field settings-field-wide">Preferred topic<select className="console-input" defaultValue="Balanced rotation"><option>Balanced rotation</option><option>Arrays & strings</option><option>Graphs & trees</option><option>Dynamic programming</option></select></label>
      </div>
      <div className="settings-divider" />
      <div className="settings-list">
        <Toggle enabled={preferences.quickQueue} onClick={() => toggle("quickQueue")} title="Enter queue with defaults" copy="Skip the confirmation step when starting a ranked search." />
        <Toggle enabled={preferences.directInvites} onClick={() => toggle("directInvites")} title="Accept room invitations" copy="Allow trusted players to send direct room invites." />
      </div>
    </>
  );

  const interfacePanel = (
    <>
      <PanelHeader kicker="Desk configuration / presentation" title="Competition desk" copy="Control density and motion without weakening the match-focused visual system." status="Dark desk" icon={MonitorCog} />
      <div className="settings-density">
        <button type="button" onClick={() => setDeskMode("standard")} className={deskMode === "standard" ? "is-selected" : ""}><LayoutPanelTop className="h-5 w-5" /><span>Standard desk</span><small>Balanced intelligence strips</small></button>
        <button type="button" onClick={() => setDeskMode("compact")} className={deskMode === "compact" ? "is-selected" : ""}><SlidersHorizontal className="h-5 w-5" /><span>Compact desk</span><small>More problem workspace</small></button>
      </div>
      <div className="settings-divider" />
      <div className="settings-list">
        <Toggle enabled={preferences.reducedMotion} onClick={() => toggle("reducedMotion")} title="Reduce interface motion" copy="Minimize scanning, transitions, and animated status treatments." />
      </div>
    </>
  );

  const notificationPanel = (
    <>
      <PanelHeader kicker="Signal routing / attention" title="Notifications" copy="Choose which match moments deserve an interruption at your competition desk." status="Active" icon={BellRing} />
      <div className="settings-list mt-8">
        <Toggle enabled={preferences.matchFound} onClick={() => toggle("matchFound")} title="Match found" copy="Alert when a compatible opponent enters your queue range." />
        <Toggle enabled={preferences.directInvites} onClick={() => toggle("directInvites")} title="Room invitation" copy="Alert when another player shares a private room with you." />
        <Toggle enabled={preferences.weeklyReview} onClick={() => toggle("weeklyReview")} title="Weekly review" copy="Receive one summary of your completed fights and focused topics." />
      </div>
    </>
  );

  const accountPanel = (
    <>
      <PanelHeader kicker="Account channel / protection" title="Account & privacy" copy="Keep your account secure and decide how your presence appears to other competitors." status="Protected" icon={ShieldCheck} />
      <div className="settings-list mt-8">
        <Toggle enabled={preferences.discoverable} onClick={() => toggle("discoverable")} title="Appear in player discovery" copy="Allow similarly ranked players to find your public player card." />
      </div>
      <div className="settings-divider" />
      <div className="settings-security-card">
        <LockKeyhole className="h-5 w-5 text-[#b5df73]" />
        <div><p>Account security</p><span>Password and provider management become available when live authentication is connected.</span></div>
      </div>
    </>
  );

  const panels: Record<SettingsTab, ReactNode> = { profile: profilePanel, match: matchPanel, interface: interfacePanel, notifications: notificationPanel, account: accountPanel };

  return (
    <div className="settings-page page-wrap enter-up mx-auto max-w-6xl">
      <header className="settings-page-head">
        <div>
          <p className="section-kicker">Personal control deck</p>
          <h1><span className="settings-gear">◈</span> Settings</h1>
          <p>Tune the way you appear, compete, and receive match signals.</p>
        </div>
        <div className="settings-head-intel">
          <div className="settings-context"><span>{activeMeta.label}</span><ChevronRight className="h-4 w-4" /><span>{activeMeta.note}</span></div>
          <div className="settings-ready-strip"><span><i /> Arena live</span><strong>03</strong><small>Season</small><strong>{player?.rating || 1500}</strong><small>Rating</small></div>
        </div>
      </header>
      <div className="settings-layout">
        <aside className="settings-sidepanel">
          <div className="settings-search"><Search className="h-4 w-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search settings" aria-label="Search settings" /></div>
          <nav aria-label="Settings sections">
            {visibleTabs.map(({ id, label, icon: Icon, note }) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`settings-nav-item ${activeTab === id ? "is-active" : ""}`}><Icon className="h-4 w-4" /><span><strong>{label}</strong><small>{note}</small></span>{activeTab === id && <ChevronRight className="ml-auto h-4 w-4" />}</button>)}
          </nav>
          <div className="settings-signal-card"><p><i /> Queue channel open</p><strong>14,320</strong><span>competitors active</span></div>
          <div className="settings-side-note"><ShieldCheck className="h-4 w-4" /><span>Changes stay local until account storage is connected.</span></div>
        </aside>
        <section className="settings-main-panel">
          {panels[activeTab]}
          <div className="settings-actions"><button type="button" onClick={() => toast("No pending changes")} className="secondary-button">Cancel</button><button type="button" onClick={save} className="primary-button"><Check className="h-4 w-4" />Save changes</button></div>
        </section>
      </div>
    </div>
  );
}
