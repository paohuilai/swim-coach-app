import { ClerkProvider, SignedIn, SignedOut } from "@clerk/clerk-react";
import { zhCN } from "@clerk/localizations";
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import AthletesList from "./pages/AthletesList";
import AthleteDetails from "./pages/AthleteDetails";
import TrainingEntry from "./pages/TrainingEntry";
import Ranking from "./pages/Ranking";
// import Insights from "./pages/Insights"; // Removed
import TrainingPlans from "./pages/TrainingPlans";
import RoleManagement from "./pages/RoleManagement";
import Login from "./pages/Login";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
// import ManagerTasks from "./pages/ManagerTasks"; // Removed
// import CoachManagement from "./pages/CoachManagement"; // Removed
import ManagerSupervision from "./pages/ManagerSupervision";

// National Team Modules
import NationalLayout from "./layouts/NationalLayout";
import CommandCenter from "./pages/national/CommandCenter";
import AthleteProfile from "./pages/national/AthleteProfile";
import SmartPlan from "./pages/national/SmartPlan";
import WarRoom from "./pages/national/WarRoom";
import TeamCollaboration from "./pages/national/TeamCollaboration";
import SystemTools from "./pages/national/SystemTools";
import AutomationConfig from "./pages/national/AutomationConfig";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  console.error("Missing Clerk Publishable Key");
}

function ClerkProviderWithRoutes() {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey || "pk_test_placeholder"}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      localization={zhCN}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/"
      appearance={{
        layout: {
          socialButtonsPlacement: 'bottom',
          socialButtonsVariant: 'iconButton',
        },
        variables: {
          colorPrimary: '#2563eb',
        }
      }}
    >
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={
          <>
            <SignedIn>
              <Navigate to="/plans" replace />
            </SignedIn>
            <SignedOut>
              <Login />
            </SignedOut>
          </>
        } />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />

        {/* Protected Routes */}
        <Route path="/national" element={
            <>
              <SignedIn>
                <NationalLayout />
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" />
              </SignedOut>
            </>
        }>
            <Route path="tasks" element={<CommandCenter />} />
            <Route path="athletes" element={<AthleteProfile />} />
            <Route path="athletes/:id" element={<AthleteProfile />} />
            <Route path="plans" element={<SmartPlan />} />
            <Route path="war-room" element={<WarRoom />} />
            <Route path="team" element={<TeamCollaboration />} />
            <Route path="tools" element={<SystemTools />} />
            <Route path="automation" element={<AutomationConfig />} />
            <Route index element={<Navigate to="tasks" replace />} />
        </Route>

        {/* Daily Management Removed */}
        {/* <Route
          path="/daily"
          element={
            <>
              <SignedIn>
                <DashboardLayout>
                  <DailyManagement />
                </DashboardLayout>
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" />
              </SignedOut>
            </>
          }
        /> */}
        {/* Manager Tasks Removed */}
        {/* <Route
          path="/tasks"
          element={
            <>
              <SignedIn>
                <DashboardLayout>
                  <ManagerTasks />
                </DashboardLayout>
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" />
              </SignedOut>
            </>
          }
        /> */}
        {/* Coach Management Removed */}
        {/* <Route
          path="/coaches"
          element={
            <>
              <SignedIn>
                <DashboardLayout>
                  <CoachManagement />
                </DashboardLayout>
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" />
              </SignedOut>
            </>
          }
        /> */}
        <Route
          path="/supervision"
          element={
            <>
              <SignedIn>
                <DashboardLayout>
                  <ManagerSupervision />
                </DashboardLayout>
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" />
              </SignedOut>
            </>
          }
        />
        <Route
          path="/plans"
          element={
            <>
              <SignedIn>
                <DashboardLayout>
                  <TrainingPlans />
                </DashboardLayout>
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" />
              </SignedOut>
            </>
          }
        />
        <Route
          path="/athletes"
          element={
            <>
              <SignedIn>
                <DashboardLayout>
                  <AthletesList />
                </DashboardLayout>
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" />
              </SignedOut>
            </>
          }
        />
        <Route
          path="/roles"
          element={
            <>
              <SignedIn>
                <DashboardLayout>
                  <RoleManagement />
                </DashboardLayout>
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" />
              </SignedOut>
            </>
          }
        />
        <Route
          path="/athletes/:id"
          element={
            <>
              <SignedIn>
                <DashboardLayout>
                  <AthleteDetails />
                </DashboardLayout>
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" />
              </SignedOut>
            </>
          }
        />
        <Route
          path="/athletes/:id/log"
          element={
            <>
              <SignedIn>
                <DashboardLayout>
                  <TrainingEntry />
                </DashboardLayout>
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" />
              </SignedOut>
            </>
          }
        />
        {/* Insights Module Removed */}
        {/* <Route
          path="/insights"
          element={
            <>
              <SignedIn>
                <DashboardLayout>
                  <Insights />
                </DashboardLayout>
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" />
              </SignedOut>
            </>
          }
        /> */}
        <Route
          path="/ranking"
          element={
            <>
              <SignedIn>
                <DashboardLayout>
                  <Ranking />
                </DashboardLayout>
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" />
              </SignedOut>
            </>
          }
        />
      </Routes>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ClerkProviderWithRoutes />
    </BrowserRouter>
  );
}
