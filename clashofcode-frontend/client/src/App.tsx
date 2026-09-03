/**
 * Style system: ClashOfCode Tournament Console — routes retain a stable competition desk
 * while dedicated room paths make host, guest, and live lobby flows explicit.
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "@/components/AppShell";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
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
import PracticeProblem from "@/pages/PracticeProblem";
import Profile from "@/pages/Profile";
import Result from "@/pages/Result";
import RoomCreate from "@/pages/RoomCreate";
import RoomJoin from "@/pages/RoomJoin";
import RoomLobby from "@/pages/RoomLobby";
import RoomWaiting from "@/pages/RoomWaiting";
import Signup from "@/pages/Signup";
import Settings from "@/pages/Settings";
import { Route, Switch, Redirect, useLocation } from "wouter";

function PrivateRoute({ component: Component, ...rest }: { component: any; path?: string }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-[#0a0b0d]"><div className="text-[#848792]">Loading...</div></div>;
  }

  if (!isAuthenticated) {
    // Redirect to login, preserve the attempted path
    const returnTo = encodeURIComponent(location);
    return <Redirect to={`/login?returnTo=${returnTo}`} />;
  }

  return <Component {...rest} />;
}

function PrivateRouter() { 
  return (
    <AppShell>
      <Switch>
        <Route path="/app"><PrivateRoute component={Dashboard} /></Route>
        <Route path="/matchmaking"><PrivateRoute component={Matchmaking} /></Route>
        <Route path="/rooms/create"><PrivateRoute component={RoomCreate} /></Route>
        <Route path="/room/create"><PrivateRoute component={RoomCreate} /></Route>
        <Route path="/join/:code"><PrivateRoute component={RoomJoin} /></Route>
        <Route path="/join"><PrivateRoute component={RoomJoin} /></Route>
        <Route path="/room/:code/wait"><PrivateRoute component={RoomWaiting} /></Route>
        <Route path="/room/:code"><PrivateRoute component={RoomLobby} /></Route>
        <Route path="/battle/:matchId"><PrivateRoute component={Battle} /></Route>
        <Route path="/battle"><PrivateRoute component={Battle} /></Route>
        <Route path="/result"><PrivateRoute component={Result} /></Route>
        <Route path="/practice/:problemId"><PrivateRoute component={PracticeProblem} /></Route>
        <Route path="/practice"><PrivateRoute component={Practice} /></Route>
        <Route path="/leaderboard"><PrivateRoute component={Leaderboard} /></Route>
        <Route path="/friends"><PrivateRoute component={Friends} /></Route>
        <Route path="/settings"><PrivateRoute component={Settings} /></Route>
        <Route path="/profile/edit"><PrivateRoute component={EditProfile} /></Route>
        <Route path="/profile"><PrivateRoute component={Profile} /></Route>
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  ); 
}

function Router() { 
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route component={PrivateRouter} />
    </Switch>
  ); 
}

export default function App() { 
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <Toaster theme="dark" richColors position="bottom-right" />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  ); 
}
