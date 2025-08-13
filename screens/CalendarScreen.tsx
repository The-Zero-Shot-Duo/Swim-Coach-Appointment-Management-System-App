// screens/CalendarScreen.tsx

import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import TopBar from "../components/TopBar";
import CalendarView from "../components/CalendarView";
import EventDialog from "../components/EventDialog";

// 1. 导入 useAuth Hook
import { useAuth } from "../lib/AuthContext";
import { fetchCoachEvents } from "../api/mock";
import { LessonEvent } from "../lib/types";

export default function CalendarScreen() {
  // 2. 从 AuthContext 获取当前登录的 user 对象
  const { user } = useAuth();

  const [events, setEvents] = useState<LessonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LessonEvent | null>(null);

  // 3. useEffect 的依赖项变为 user 对象
  //    当 user 状态改变时 (登录或登出)，这个 effect 会重新运行
  useEffect(() => {
    const loadData = async () => {
      // 确保 user 对象存在
      if (user) {
        setLoading(true);
        // 4. 使用 user.uid 作为 coachId 来获取课程数据
        //    user.uid 是 Firebase 提供的唯一用户ID，比邮箱更可靠
        const data = await fetchCoachEvents(user.uid);
        setEvents(data);
        setLoading(false);
      }
    };
    loadData();
  }, [user]); // 依赖于从 context 来的 user

  // 5. 副标题现在可以使用 user.email 或 user.displayName
  const subtitle = useMemo(() => (user ? `Coach: ${user.email}` : ""), [user]);

  function handleEventClick(event: LessonEvent) {
    setSelectedEvent(event);
    setDialogOpen(true);
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
  main: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  subtitle: { fontWeight: "bold" },
  infoText: { marginTop: 8, color: "#666" },
});
