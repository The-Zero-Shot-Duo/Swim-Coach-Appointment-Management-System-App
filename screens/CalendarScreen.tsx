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

  // 状态回归到只管理原始的 events 数组
  const [events, setEvents] = useState<LessonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LessonEvent | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        setLoading(true);
        const eventsData = await fetchCoachEvents(user.uid);
        setEvents(eventsData); // 直接设置原始数据
        setLoading(false);
      } else {
        setEvents([]);
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const subtitle = useMemo(
    () => (user ? `Coach: ${user.displayName || user.email}` : ""),
    [user]
  );

  function handleEventClick(event: LessonEvent) {
    setSelectedEvent(event);
    setDialogOpen(true);
  }

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
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator animating={true} size="large" />
        </View>
      ) : (
        <>
          {events.length === 0 && (
            <Text style={styles.infoText}>No lessons scheduled.</Text>
          )}
          {/* 将原始的 events 数组传递给 CalendarView */}
          <CalendarView events={events} onEventClick={handleEventClick} />
        </>
      )}

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
  infoText: { textAlign: "center", marginTop: 20, color: "#666" },
});
