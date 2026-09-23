import { useCallback, useEffect, useMemo, useState } from "react";
import MapEngine from "./ported-map/MapEngine.js";
import { createV3SupabaseClient } from "./supabase/client.js";
import { UberAuthPanel } from "./supabase/AuthPanel.js";
import { ChangelogModal } from "./dashboard/ChangelogModal.js";
import { UberRepository } from "./uber/repository.js";
import { UberWeekService } from "./uber/service.js";
import { deriveEarningsTransition, type EarningsTransition } from "./uber/milestones.js";
import type { UberDashboard, WeeklySummary, WorkWeight } from "./uber/types.js";

const SUPABASE_URL = "https://doaokmhdfwdwtkwxxksx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_r_oYKrDrzU-BGgNIerSu9w_DSLnSTLJ";

export default function App() {
  const supabaseClient = useMemo(() => createV3SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY), []);
  const service = useMemo(() => new UberWeekService(new UberRepository(supabaseClient)), [supabaseClient]);
  
  const [session, setSession] = useState<boolean | null>(null);
  const [dashboard, setDashboard] = useState<UberDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transition, setTransition] = useState<EarningsTransition | null>(null);
  const [viewDate, setViewDate] = useState<string | null>(null);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, newSession) => {
      setSession(!!newSession);
      if (!newSession) setDashboard(null);
    });
    return () => subscription.unsubscribe();
  }, [supabaseClient]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setError(null);
    void service.initializeCurrentWeek()
      .then(() => service.getDashboard((viewDate as any) ?? undefined))
      .then((value) => {
        if (active) {
          setDashboard(value);
          if (!value) setError("Current week plan could not be loaded");
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load Uber data");
      });
    return () => { active = false; };
  }, [service, viewDate, session]);

  const saveEarnings = useCallback(async (previewPence: number) => {
    const refreshed = await service.saveTodayEarnings(previewPence, dashboard?.today);
    if (!refreshed) throw new Error("No current week plan exists");
    if (dashboard) setTransition(deriveEarningsTransition(dashboard, refreshed, Date.now()));
    setDashboard(refreshed);
    return refreshed;
  }, [service, dashboard]);

  const saveMileage = useCallback(async (milesTenths: number) => {
    const refreshed = await service.saveTodayMileage(milesTenths, dashboard?.today);
    if (!refreshed) throw new Error("No current week plan exists");
    setDashboard(refreshed);
    return refreshed;
  }, [service, dashboard]);

  const savePlan = useCallback(async (weights: Array<WorkWeight | null>) => {
    const refreshed = await service.saveCurrentWeekWeights(weights, dashboard?.today);
    if (!refreshed) throw new Error("No current week plan exists");
    setDashboard(refreshed);
    return refreshed;
  }, [service, dashboard]);

  const loadHistory = useCallback(async (): Promise<WeeklySummary[]> => {
    return service.getWeeklyHistory(dashboard?.today);
  }, [service, dashboard]);

  const startSession = useCallback(async () => {
    const refreshed = await service.startSession(dashboard?.today);
    if (!refreshed) throw new Error("No current week plan exists");
    setDashboard(refreshed);
    return refreshed;
  }, [service, dashboard]);

  const pauseSession = useCallback(async () => {
    const refreshed = await service.pauseSession(dashboard?.today);
    if (!refreshed) throw new Error("No current week plan exists");
    setDashboard(refreshed);
    return refreshed;
  }, [service, dashboard]);

  const resumeSession = useCallback(async () => {
    const refreshed = await service.resumeSession(dashboard?.today);
    if (!refreshed) throw new Error("No current week plan exists");
    setDashboard(refreshed);
    return refreshed;
  }, [service, dashboard]);

  const endSession = useCallback(async () => {
    const refreshed = await service.endSession(dashboard?.today);
    if (!refreshed) throw new Error("No current week plan exists");
    setDashboard(refreshed);
    return refreshed;
  }, [service, dashboard]);

  const [showChangelog, setShowChangelog] = useState(false);

  useEffect(() => {
    (window as any).showChangelog = () => setShowChangelog(true);
  }, []);

  return (
    <>
      <MapEngine
        dashboard={dashboard}
        preview={false}
        onSaveTodayEarnings={saveEarnings}
        onSaveMileage={saveMileage}
        onSavePlan={savePlan}
        onLoadHistory={loadHistory}
        onChangeDate={setViewDate}
        onSignOut={async () => { await supabaseClient.auth.signOut(); }}
        onStartSession={startSession}
        onPauseSession={pauseSession}
        onResumeSession={resumeSession}
        onEndSession={endSession}
        transition={transition}
      />
      {session === false && <UberAuthPanel client={supabaseClient} />}
      {!dashboard && error && session && (
        <div className="uber-load-error" role="status" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <span>Uber data unavailable: {error}</span>
          <button type="button" onClick={() => supabaseClient?.auth.signOut()} style={{ padding: "6px 12px", background: "#ff6379", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Sign Out</button>
        </div>
      )}
      {showChangelog && (
        <div className="uber-modal-backdrop" role="presentation" onMouseDown={() => setShowChangelog(false)}>
          <section className="uber-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <ChangelogModal onClose={() => setShowChangelog(false)} />
          </section>
        </div>
      )}
    </>
  );
}
