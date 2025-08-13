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
  const { user } = useAuth();

  const [events, setEvents] = useState<LessonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LessonEvent | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        setLoading(true);
        // 重要：确保您在 Firestore 中的 coachId 与 user.uid 匹配
        // 我们用 user.uid 来获取该教练的课程
        const data = await fetchCoachEvents(user.uid);
        setEvents(data);
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

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

  // ✅ 增加另一层保护：如果 user 对象还没加载好，可以显示加载中...
  if (!user) {
    return (
      <View style={styles.container}>
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
  container: { flex: 1, justifyContent: "center", backgroundColor: "white" },
  main: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  subtitle: { fontWeight: "bold" },
  infoText: { marginTop: 8, color: "#666" },
});
