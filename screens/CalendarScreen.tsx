// screens/CalendarScreen.tsx

import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import TopBar from "../components/TopBar";
import CalendarView from "../components/CalendarView";
import EventDialog from "../components/EventDialog";

import { getUser } from "../lib/auth";
import { fetchCoachEvents } from "../api/mock";
import { LessonEvent } from "../lib/types";

export default function CalendarScreen() {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [events, setEvents] = useState<LessonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LessonEvent | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const currentUser = await getUser();
      if (currentUser) {
        setUser(currentUser);
        // 从模拟API获取数据
        const data = await fetchCoachEvents(currentUser.id);
        setEvents(data);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const subtitle = useMemo(() => (user ? `Coach: ${user.name}` : ""), [user]);

  // 点击日历事件时的处理函数
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
      {/* 将获取到的事件和点击处理器传递给日历视图 */}
      <CalendarView events={events} onEventClick={handleEventClick} />

      {/* 仅在有选定事件时渲染弹窗 */}
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
