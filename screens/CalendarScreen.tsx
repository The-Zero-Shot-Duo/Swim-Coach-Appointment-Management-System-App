// screens/CalendarScreen.tsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { DateData } from "react-native-calendars";

import TopBar from "../components/TopBar";
import CalendarView from "../components/CalendarView";
import EventDialog from "../components/EventDialog";

import { useAuth } from "../lib/AuthContext";
import { fetchCoachEvents } from "../api/mock";
import { LessonEvent } from "../lib/types";

export default function CalendarScreen() {
  const { user } = useAuth();

  const [allEvents, setAllEvents] = useState<LessonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LessonEvent | null>(null);

  // State to track the currently selected day on the calendar
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        setLoading(true);
        const eventsData = await fetchCoachEvents(user.uid);
        setAllEvents(eventsData);
        setLoading(false);
      } else {
        setAllEvents([]);
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  // Memoized list of events for only the selected day
  const eventsForSelectedDay = useMemo(() => {
    return allEvents.filter((event) => event.start.startsWith(selectedDate));
  }, [allEvents, selectedDate]);

  // Memoized markings for the calendar (dots under dates with events)
  const markedDates = useMemo(() => {
    const markings: { [key: string]: { marked: true; dotColor: string } } = {};
    allEvents.forEach((event) => {
      const dateKey = event.start.split("T")[0];
      markings[dateKey] = { marked: true, dotColor: "deepskyblue" };
    });
    return markings;
  }, [allEvents]);

  const subtitle = useMemo(
    () => (user ? `Coach: ${user.displayName || user.email}` : ""),
    [user]
  );

  const handleDayPress = useCallback((day: DateData) => {
    setSelectedDate(day.dateString);
  }, []);

  const handleEventClick = useCallback((event: LessonEvent) => {
    setSelectedEvent(event);
    setDialogOpen(true);
  }, []);

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
        // Pass all necessary props to the new CalendarView
        <CalendarView
          events={eventsForSelectedDay}
          markedDates={markedDates}
          selectedDate={selectedDate}
          onDayPress={handleDayPress}
          onEventClick={handleEventClick}
        />
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
