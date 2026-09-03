/**
 * Style system: Tournament Console — social features remain compact and match-oriented,
 * framing friends as potential practice partners rather than a distracting feed.
 */
import { Avatar, MatchLine, Pill, RankBadge, Streak } from "@/components/ArenaPrimitives";
import { Bell, Crown, MessageSquare, Plus, Search, Swords, UserPlus, Users, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useFriendsData } from "@/hooks/useFriendsData";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";

export default function Friends() {
  const { friends, loading, error } = useFriendsData();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [rivalryData, setRivalryData] = useState<any>(null);
  const [loadingRivalry, setLoadingRivalry] = useState(false);
  const [selectedRival, setSelectedRival] = useState<string | null>(null);

  // Load rivalry data for the first friend if available
  useEffect(() => {
    if (friends && friends.length > 0 && !selectedRival) {
      setSelectedRival(friends[0].handle);
    }
  }, [friends]);

  useEffect(() => {
    if (selectedRival) {
      loadRivalryData(selectedRival);
    }
  }, [selectedRival]);

  // Load pending requests on mount
  useEffect(() => {
    loadPendingRequests();
  }, []);

  const loadPendingRequests = async () => {
    setLoadingRequests(true);
    try {
      const response = await api.get("/friends/requests");
      setPendingRequests(response.data || []);
    } catch (err) {
      console.error("Failed to load pending requests:", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadRivalryData = async (handle: string) => {
    setLoadingRivalry(true);
    try {
      const response = await api.get(`/friends/${handle}/rivalry`);
      setRivalryData(response.data);
    } catch (err) {
      console.error("Failed to load rivalry data:", err);
      setRivalryData(null);
    } finally {
      setLoadingRivalry(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await api.post("/friends/search", { query: query.trim() });
      setSearchResults(response.data || []);
    } catch (err: any) {
      console.error("Failed to search users:", err);
      toast.error("Failed to search users");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (username: string) => {
    try {
      const response = await api.post("/friends/requests", { handle: username });
      toast.success(response.data.message || `Friend request sent to ${username}`);
      // Remove from search results
      setSearchResults(searchResults.filter(u => u.username !== username));
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to send friend request");
    }
  };

  const handleAcceptRequest = async (requesterId: string, requesterUsername: string) => {
    try {
      const response = await api.post(`/friends/requests/${requesterId}/accept`);
      toast.success(response.data.message || `You are now friends with ${requesterUsername}`);
      // Remove from pending requests
      setPendingRequests(pendingRequests.filter(r => r.requesterId !== requesterId));
      // Refresh friends list
      window.location.reload();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to accept friend request");
    }
  };

  const handleDeclineRequest = async (requesterId: string) => {
    try {
      await api.delete(`/friends/requests/${requesterId}`);
      toast.success("Friend request declined");
      // Remove from pending requests
      setPendingRequests(pendingRequests.filter(r => r.requesterId !== requesterId));
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to decline friend request");
    }
  };

  const handleChallenge = async (handle: string, state: string) => {
    if (state === "In battle") {
      toast.error(`${handle} is currently in a battle`);
      return;
    }

    try {
      const response = await api.post(`/friends/${handle}/challenge`);
      const roomCode = response.data.roomCode;
      toast.success(`Challenge room created!`, { description: `Code: ${roomCode}` });
      // Navigate to the room lobby
      setLocation(`/room/${roomCode}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create challenge");
    }
  };

  const handleRematch = async (handle: string) => {
    try {
      const response = await api.post(`/friends/${handle}/rematch-invite`);
      const roomCode = response.data.roomCode;
      toast.success(`Rematch room created!`, { description: `Code: ${roomCode}` });
      // Navigate to the room lobby
      setLocation(`/room/${roomCode}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create rematch");
    }
  };

  if (loading) {
    return <div className="page-wrap enter-up p-8 flex justify-center text-[#848792]">Loading friends...</div>;
  }
  if (error) {
    return <div className="page-wrap enter-up p-8 flex justify-center text-[#e48b87]">Error loading friends.</div>;
  }

  return <div className="page-wrap enter-up"><header><MatchLine label="Social / your circles" /><div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-4xl font-bold tracking-[-.07em] sm:text-5xl">Your coding circle.</h1><p className="mt-2 max-w-lg text-sm leading-6 text-[#989ba5]">Find a familiar rival, send a private challenge, or keep pace with your crew.</p></div><button onClick={() => setShowSearch(!showSearch)} className="primary-button"><UserPlus className="h-4 w-4" />Add friend</button></div></header>
  
  {showSearch && <div className="mt-5 panel p-5"><p className="section-kicker">Search users</p><div className="mt-3 flex gap-2"><input type="text" value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder="Search by username..." className="flex-1 rounded-lg border border-white/[.12] bg-white/[.04] px-4 py-2 text-sm text-[#e0e1e5] placeholder:text-[#777a85] focus:border-[#f04432] focus:outline-none" /><button onClick={() => setShowSearch(false)} className="secondary-button">Close</button></div>{searching && <p className="mt-3 text-sm text-[#777a85]">Searching...</p>}{searchResults.length > 0 && <div className="mt-4 space-y-2">{searchResults.map((user: any) => <div key={user.id} className="flex items-center gap-3 border border-white/[.08] bg-white/[.025] p-3"><Avatar initials={user.username.substring(0, 2).toUpperCase()} tone="blue" /><div className="flex-1"><span className="text-sm font-semibold text-[#dedfe3]">{user.username}</span><p className="font-mono text-[10px] text-[#777a85]">RATING: {user.rating}</p></div><RankBadge rank={user.rank} /><button onClick={() => handleSendRequest(user.username)} className="primary-button min-h-8 px-3 text-[11px]"><UserPlus className="h-3.5 w-3.5" />Send request</button></div>)}</div>}{!searching && searchQuery && searchResults.length === 0 && <p className="mt-3 text-sm text-[#777a85]">No users found</p>}</div>}

  {pendingRequests.length > 0 && <div className="mt-5 panel p-5"><div className="flex items-center gap-2"><Bell className="h-4 w-4 text-[#83a8ff]" /><p className="section-kicker">Pending requests</p></div><div className="mt-4 space-y-2">{pendingRequests.map((request: any) => <div key={request.requesterId} className="flex items-center gap-3 border border-white/[.08] bg-white/[.025] p-3"><Avatar initials={request.requesterUsername.substring(0, 2).toUpperCase()} tone="lime" /><div className="flex-1"><span className="text-sm font-semibold text-[#dedfe3]">{request.requesterUsername}</span><p className="font-mono text-[10px] text-[#777a85]">RATING: {request.requesterRating}</p></div><RankBadge rank={request.requesterRank} /><button onClick={() => handleAcceptRequest(request.requesterId, request.requesterUsername)} className="primary-button min-h-8 px-3 text-[11px]"><Check className="h-3.5 w-3.5" />Accept</button><button onClick={() => handleDeclineRequest(request.requesterId)} className="secondary-button min-h-8 px-3 text-[11px]"><X className="h-3.5 w-3.5" />Decline</button></div>)}</div></div>}
  
  <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]"><section className="panel p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="section-kicker">Available players</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-.055em]">Friends & rivals</h2></div></div><div className="mt-5 space-y-2">{friends && friends.length > 0 ? friends.map((friend: any, index: number) => <div key={friend.handle} className="flex flex-wrap items-center gap-3 border border-white/[.08] bg-white/[.025] p-3.5"><Avatar initials={friend.initials} tone={index % 2 ? "blue" : "lime"} /><div className="min-w-[150px] flex-1"><div className="flex items-center gap-2"><span className="text-sm font-semibold text-[#dedfe3]">{friend.handle}</span><span className={`h-1.5 w-1.5 rounded-full ${friend.state === "Offline" ? "bg-[#61646e]" : friend.state === "In battle" ? "bg-[#f04432]" : "bg-[#b5df73]"}`} /></div><p className="mt-1 font-mono text-[10px] text-[#777a85]">{friend.activity?.toUpperCase()}</p></div><div className="flex items-center gap-2"><RankBadge rank={friend.rank} /><span className="font-mono text-xs text-[#cacbd0]">{friend.rating}</span></div><button onClick={() => handleChallenge(friend.handle, friend.state)} disabled={friend.state === "In battle"} className="secondary-button min-h-8 px-3 text-[11px] disabled:cursor-not-allowed disabled:opacity-40"><Swords className="h-3.5 w-3.5" />Challenge</button></div>) : <p className="text-center text-sm text-[#777a85] py-8">No friends yet. Add some friends to start challenging them!</p>}</div></section><aside className="space-y-5">{rivalryData && selectedRival ? <section className="panel p-5"><div className="flex items-center gap-2"><Crown className="h-4 w-4 text-[#e1a759]" /><p className="section-kicker">Rivalry board</p></div><p className="mt-4 font-display text-2xl font-bold tracking-[-.055em]">{selectedRival}</p><p className="mt-1 text-xs leading-5 text-[#9295a0]">{rivalryData.wins > rivalryData.losses ? `You lead the series ${rivalryData.wins}–${rivalryData.losses}` : rivalryData.losses > rivalryData.wins ? `You trail the series ${rivalryData.losses}–${rivalryData.wins}` : `The series is tied ${rivalryData.wins}–${rivalryData.losses}`}. {rivalryData.matches > 0 ? "A rematch is only one click away." : "No matches yet!"}</p><div className="mt-5 grid grid-cols-3 border-y border-white/[.08] py-4 text-center"><div><p className="font-mono text-lg text-[#b5df73]">{rivalryData.wins}</p><span className="section-kicker">Wins</span></div><div className="border-x border-white/[.08]"><p className="font-mono text-lg">{rivalryData.matches}</p><span className="section-kicker">Matches</span></div><div><p className="font-mono text-lg text-[#e48b87]">{rivalryData.losses}</p><span className="section-kicker">Losses</span></div></div><button onClick={() => handleRematch(selectedRival)} className="primary-button mt-5 w-full"><Swords className="h-4 w-4" />Invite to rematch</button></section> : <section className="panel p-5"><div className="flex items-center gap-2"><Crown className="h-4 w-4 text-[#e1a759]" /><p className="section-kicker">Rivalry board</p></div><p className="mt-4 text-sm text-[#9295a0]">{loadingRivalry ? "Loading rivalry data..." : "Add friends to see rivalry stats!"}</p></section>}<section className="panel p-5"><div className="flex items-center gap-2"><Bell className="h-4 w-4 text-[#83a8ff]" /><p className="section-kicker">Social features</p></div><p className="mt-4 font-display text-xl font-bold tracking-[-.05em]">Real-time challenges.</p><p className="mt-2 text-xs leading-5 text-[#9295a0]">Challenge friends, track rivalry stats, and compete head-to-head. Notification system coming soon.</p></section></aside></div></div>;
}
