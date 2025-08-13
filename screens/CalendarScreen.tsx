// screens/CalendarScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import TopBar from "../components/TopBar"; // 下一步会创建
import CalendarView from "../components/CalendarView"; // 下一步会创建
import EventDialog from "../components/EventDialog"; // 下一步会创建

import { getUser } from "../lib/auth"; // 异步版本
import { fetchCoachEvents } from "../api/mock"; // 现在应从 Firebase/后端获取
import { LessonEvent } from "../lib/types";

export default function CalendarScreen() {
  const [user, setUser] = useState(null);
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
        const data = await fetchCoachEvents(currentUser.id);
        setEvents(data);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const subtitle = useMemo(() => (user ? `Coach: ${user.name}` : ""), [user]);

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
          data={selectedEvent} // 直接传递整个事件对象
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
