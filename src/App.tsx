import { ClerkProvider, SignedIn, SignedOut } from "@clerk/clerk-react";
import { zhCN } from "@clerk/localizations";
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import AthletesList from "./pages/AthletesList";
import AthleteDetails from "./pages/AthleteDetails";
import TrainingEntry from "./pages/TrainingEntry";
import Ranking from "./pages/Ranking";
import Insights from "./pages/Insights";
import Login from "./pages/Login";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  console.error("Missing Clerk Publishable Key");
}

function ClerkProviderWithRoutes() {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey || "pk_test_placeholder"}
      navigate={(to) => navigate(to)}
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
              <Navigate to="/dashboard" replace />
            </SignedIn>
            <SignedOut>
              <Login />
            </SignedOut>
          </>
        } />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <>
              <SignedIn>
                <DashboardLayout>
                  <Dashboard />
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
        <Route
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
        />
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
