// screens/CalendarScreen.tsx

import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import TopBar from "../components/TopBar";
import CalendarView from "../components/CalendarView";
import EventDialog from "../components/EventDialog";

import { useAuth } from "../lib/AuthContext";
import { fetchCoachEvents } from "../api/mock";
import { LessonEvent } from "../lib/types";

export default function CalendarScreen() {
  console.log("CalendarScreen is rendering."); // <-- 添加这行

  const { user } = useAuth();

  const [events, setEvents] = useState<LessonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LessonEvent | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        console.log("当前登录用户的 UID 是:", user.uid);
        setLoading(true);
        const data = await fetchCoachEvents(user.uid);
        setEvents(data);
        setLoading(false);
      } else {
        setEvents([]);
      }
    };

    loadData();
  }, [user]); // ✅ 关键修复：确保依赖数组里只有 user

  // ✅ 关键修复：增加了一层保护
  //    - useMemo 用于优化性能
  //    - `user ? ... : ""` 确保在 user 对象存在时才访问其属性
  //    - `user.displayName || user.email` 提供了后备选项，如果用户没有设置 displayName，就显示 email
  const subtitle = useMemo(
    () => (user ? `Coach: ${user.displayName || user.email}` : ""),
    [user]
  );

  function handleEventClick(event: LessonEvent) {
    setSelectedEvent(event);
    setDialogOpen(true);
  }

  // 并且，请确保 "if (!user)" 这个加载块使用了新的样式
  if (!user) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar />
      <View style={styles.main}>
        <Text variant="titleLarge" style={styles.subtitle}>
          {subtitle}
        </Text>
        {loading && (
          <ActivityIndicator animating={true} style={{ marginTop: 8 }} />
        )}
        {!loading && events.length === 0 && (
          <Text style={styles.infoText}>No lessons scheduled.</Text>
        )}
      </View>
      <CalendarView events={events} onEventClick={handleEventClick} />

      {selectedEvent && (
        <EventDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          data={selectedEvent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  main: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  subtitle: { fontWeight: "bold" },
  infoText: { marginTop: 8, color: "#666" },
});
