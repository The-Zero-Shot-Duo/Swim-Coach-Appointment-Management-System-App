// components/TopBar.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { Appbar } from "react-native-paper";
import { useAuth } from "../lib/AuthContext";

export default function TopBar() {
  const { user, logout, ensureCoachProfile } = useAuth();
  const ensuredOnce = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (ensuredOnce.current) return;
    ensuredOnce.current = true;
    (async () => {
      try {
        await ensureCoachProfile(); // 登录后首屏保证 profile 和 displayName
        console.log("[TopBar] ensured profile for", user.uid);
      } catch (e) {
        console.error("[TopBar] ensure profile failed:", e);
      }
    })();
  }, [user?.uid, ensureCoachProfile]);

  const coachLabel = useMemo(() => {
    if (!user) return "";
    const name = user.displayName?.trim();
    if (name) return `Coach: ${name}`;
    const prefix = user.email?.split("@")[0] ?? "";
    return prefix ? `Coach: ${prefix}` : "Coach";
  }, [user?.displayName, user?.email]);

  return (
    <Appbar.Header>
      <Appbar.Content title="Swim Coach Schedule" subtitle={coachLabel} />
      <Appbar.Action icon="logout" onPress={logout} />
    </Appbar.Header>
  );
}
