import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PatientBoard from "@/pages/PatientBoard";
import PatientDetail from "@/pages/PatientDetail";
import NotFound from "@/pages/not-found";
import { useClinicalStore } from "@/store/clinicalStore";
import { listPatients, getListPatientsQueryKey } from "@workspace/api-client-react";
import KeyboardShortcutsModal from "@/components/KeyboardShortcutsModal";
import CommandCenter from "@/components/CommandCenter";
import PresentationMode from "@/components/PresentationMode";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 2000 } },
});

function GlobalKeyboardHandler() {
  const [location, navigate] = useLocation();
  const {
    setActiveTab, toggleAlertsDrawer, toggleTriageDrawer,
    setKeyboardShortcutsOpen, keyboardShortcutsOpen,
    setCommandCenterOpen, setPresentationModeOpen,
  } = useClinicalStore();
  const { data: patients } = useQuery({ queryKey: getListPatientsQueryKey(), queryFn: listPatients });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;

      if (e.key === "Escape") {
        useClinicalStore.getState().closeAlertsDrawer();
        useClinicalStore.getState().closeTriageDrawer();
        useClinicalStore.getState().setKeyboardShortcutsOpen(false);
        useClinicalStore.getState().setCommandCenterOpen(false);
        useClinicalStore.getState().setPresentationModeOpen(false);
        useClinicalStore.getState().setHandoffPatientId(null);
        return;
      }
      if (e.key === "?") { setKeyboardShortcutsOpen(!keyboardShortcutsOpen); return; }
      if (inInput) return;

      const inDetail = location.startsWith("/patient/");
      if (e.key === "b" || e.key === "B") { if (inDetail) navigate("/"); return; }
      if (e.key === "a" || e.key === "A") { toggleAlertsDrawer(); return; }
      if (e.key === "t" || e.key === "T") { toggleTriageDrawer(); return; }
      if (e.key === "c" || e.key === "C") { setCommandCenterOpen(true); return; }
      if (e.key === "p" || e.key === "P") { setPresentationModeOpen(true); return; }
      if (inDetail) {
        if (e.key === "d" || e.key === "D") { setActiveTab("diagnosis"); return; }
        if (e.key === "n" || e.key === "N") { setActiveTab("soap"); return; }
        if (e.key === "l" || e.key === "L") { setActiveTab("labs"); return; }
        if (e.key === "f" || e.key === "F") { setActiveTab("forecast"); return; }
      }
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= 8 && patients) {
        const p = patients[num - 1];
        if (p) navigate(`/patient/${p.id}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [location, navigate, patients, setActiveTab, toggleAlertsDrawer, toggleTriageDrawer,
      setKeyboardShortcutsOpen, keyboardShortcutsOpen, setCommandCenterOpen, setPresentationModeOpen]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={PatientBoard} />
      <Route path="/patient/:id" component={PatientDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { keyboardShortcutsOpen, commandCenterOpen, presentationModeOpen } = useClinicalStore();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <GlobalKeyboardHandler />
          <Router />
          {keyboardShortcutsOpen && <KeyboardShortcutsModal />}
          {commandCenterOpen && <CommandCenter />}
          {presentationModeOpen && <PresentationMode />}
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
