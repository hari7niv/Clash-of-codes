/**
 * Style system: ClashOfCode Tournament Console — routes retain a stable competition desk
 * while dedicated room paths make host, guest, and live lobby flows explicit.
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "@/components/AppShell";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Battle from "@/pages/Battle";
import Dashboard from "@/pages/Dashboard";
import EditProfile from "@/pages/EditProfile";
import Friends from "@/pages/Friends";
import Leaderboard from "@/pages/Leaderboard";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Matchmaking from "@/pages/Matchmaking";
import NotFound from "@/pages/NotFound";
import Practice from "@/pages/Practice";
import Profile from "@/pages/Profile";
import Result from "@/pages/Result";
import RoomCreate from "@/pages/RoomCreate";
import RoomJoin from "@/pages/RoomJoin";
import RoomLobby from "@/pages/RoomLobby";
import RoomWaiting from "@/pages/RoomWaiting";
import Signup from "@/pages/Signup";
import Settings from "@/pages/Settings";
import { Route, Switch } from "wouter";

function PrivateRouter() { return <AppShell><Switch><Route path="/app" component={Dashboard} /><Route path="/matchmaking" component={Matchmaking} /><Route path="/rooms/create" component={RoomCreate} /><Route path="/room/create" component={RoomCreate} /><Route path="/join/:code" component={RoomJoin} /><Route path="/join" component={RoomJoin} /><Route path="/room/:code/wait" component={RoomWaiting} /><Route path="/room/:code" component={RoomLobby} /><Route path="/battle" component={Battle} /><Route path="/result" component={Result} /><Route path="/practice" component={Practice} /><Route path="/leaderboard" component={Leaderboard} /><Route path="/friends" component={Friends} /><Route path="/settings" component={Settings} /><Route path="/profile/edit" component={EditProfile} /><Route path="/profile" component={Profile} /><Route component={NotFound} /></Switch></AppShell>; }
function Router() { return <Switch><Route path="/" component={Landing} /><Route path="/login" component={Login} /><Route path="/signup" component={Signup} /><Route component={PrivateRouter} /></Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster theme="dark" richColors position="bottom-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
