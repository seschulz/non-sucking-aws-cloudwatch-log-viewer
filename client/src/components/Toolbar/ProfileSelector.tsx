import { useEffect } from "react";
import { useLogStore } from "../../stores/logStore";
import { useToastStore } from "../../stores/toastStore";

export function ProfileDropdown() {
  const profile = useLogStore((s) => s.profile);
  const profiles = useLogStore((s) => s.profiles);
  const setProfile = useLogStore((s) => s.setProfile);
  const fetchProfiles = useLogStore((s) => s.fetchProfiles);
  const fetchRegions = useLogStore((s) => s.fetchRegions);
  const fetchSsoSessions = useLogStore((s) => s.fetchSsoSessions);
  const profileSessionMap = useLogStore((s) => s.profileSessionMap);
  const activeSsoSessions = useLogStore((s) => s.activeSsoSessions);
  const ssoLoginInProgress = useLogStore((s) => s.ssoLoginInProgress);

  useEffect(() => {
    fetchProfiles();
    fetchSsoSessions();
    if (profile) fetchRegions(profile);
  }, [fetchProfiles, fetchSsoSessions, fetchRegions, profile]);

  const handleProfileChange = (value: string) => {
    setProfile(value);
    if (value) fetchRegions(value);
  };

  const sessionName = profile ? profileSessionMap[profile] : undefined;
  const hasSso = !!sessionName;
  const ssoActive = hasSso && activeSsoSessions.includes(sessionName);

  const handleSsoLogin = async () => {
    if (!sessionName || ssoLoginInProgress) return;

    useLogStore.setState({ ssoLoginInProgress: true });
    let waitingToastId: number | null = null;

    try {
      const res = await fetch(`/api/sso-login?sessionName=${encodeURIComponent(sessionName)}`);
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.status === "waiting") {
            window.open(data.verificationUri, "_blank");
            waitingToastId = useToastStore.getState().addToast(
              `Complete SSO login in your browser (code: ${data.userCode})`,
              "info",
              60_000,
            );
          } else if (data.status === "success") {
            if (waitingToastId !== null) useToastStore.getState().removeToast(waitingToastId);
            useToastStore.getState().addToast("SSO login successful", "success", 3000);
            useLogStore.setState({ ssoLoginInProgress: false });
            // Refresh session status so the icon updates to unlocked
            fetchSsoSessions();
            // Force log groups to re-fetch by cycling region (triggers LogGroupPicker's useEffect)
            const currentRegion = useLogStore.getState().region;
            if (currentRegion) {
              useLogStore.setState({ region: "" });
              queueMicrotask(() => useLogStore.setState({ region: currentRegion }));
            }
            if (profile) fetchRegions(profile);
          } else if (data.status === "error") {
            if (waitingToastId !== null) useToastStore.getState().removeToast(waitingToastId);
            useToastStore.getState().addToast(data.message || "SSO login failed", "error");
            useLogStore.setState({ ssoLoginInProgress: false });
          }
        }
      }
    } catch (err: any) {
      if (waitingToastId !== null) useToastStore.getState().removeToast(waitingToastId);
      useToastStore.getState().addToast(err.message || "SSO login failed", "error");
      useLogStore.setState({ ssoLoginInProgress: false });
    }
  };

  return (
    <div className="flex items-center gap-1">
      <select
        value={profile ?? ""}
        onChange={(e) => handleProfileChange(e.target.value)}
        className="select select-sm border border-base-content/20 bg-base-100 w-48"
      >
        <option value="">Select profile</option>
        {profiles.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      {hasSso && (
        <button
          type="button"
          onClick={handleSsoLogin}
          disabled={ssoLoginInProgress}
          className="btn btn-ghost btn-sm btn-square"
          title={ssoLoginInProgress ? "SSO login in progress..." : ssoActive ? "SSO session active" : "SSO Login"}
        >
          {ssoLoginInProgress ? (
            <span className="loading loading-spinner loading-xs" />
          ) : ssoActive ? (
            <svg className="h-5 w-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

export function RegionDropdown() {
  const profile = useLogStore((s) => s.profile);
  const region = useLogStore((s) => s.region);
  const regions = useLogStore((s) => s.regions);
  const setRegion = useLogStore((s) => s.setRegion);

  return (
    <select
      value={region ?? ""}
      onChange={(e) => setRegion(e.target.value)}
      disabled={!profile}
      className="select select-sm border border-base-content/20 bg-base-100 w-36"
    >
      <option value="">Select region</option>
      {regions.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}

export default function ProfileSelector() {
  return (
    <div className="flex items-center gap-2">
      <ProfileDropdown />
      <RegionDropdown />
    </div>
  );
}
