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

/** ---------- 安全时间工具：兼容 Timestamp / string / Date ---------- **/
const toDate = (v: any): Date =>
  v?.toDate ? v.toDate() : v instanceof Date ? v : new Date(v);

const toYMD = (v: any) => {
  const d = toDate(v);
  // 按本地时区校正到“当天”，避免跨区导致日期偏移
  const isoLocal = new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  ).toISOString();
  return isoLocal.slice(0, 10); // "YYYY-MM-DD"
};

export default function CalendarScreen() {
  const { user } = useAuth();

  const [allEvents, setAllEvents] = useState<LessonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LessonEvent | null>(null);

  // 当前选择的日期（YYYY-MM-DD）
  const [selectedDate, setSelectedDate] = useState<string>(toYMD(new Date()));

  // 拉取数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        if (user) {
          const eventsData = await fetchCoachEvents(user.uid);
          setAllEvents(eventsData);
        } else {
          setAllEvents([]);
        }
      } catch (e) {
        console.error("[CalendarScreen] load error:", e);
        setAllEvents([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  // （如果你仍在用旧版 CalendarView，则启用这个按天过滤的 memo，并把下面 props 的 events 改成 eventsForSelectedDay）
  const eventsForSelectedDay = useMemo(() => {
    return allEvents.filter(
      (event) => toYMD((event as any).start) === selectedDate
    );
  }, [allEvents, selectedDate]);

  // 生成日历打点
  const markedDates = useMemo(() => {
    const markings: Record<string, any> = {};
    for (const ev of allEvents) {
      const key = toYMD((ev as any).start);
      // 你可以根据课程/教练自定义不同颜色的 dot；这里先给一个基础 dot
      if (!markings[key])
        markings[key] = { marked: true, dots: [{ key: "lesson" }] };
      else if (!markings[key].marked) markings[key].marked = true;
    }

    // 可选：高亮今天
    const today = toYMD(new Date());
    markings[today] = { ...(markings[today] ?? {}), today: true };
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
        <CalendarView
          // ✅ 若你使用“新版 CalendarView（内部按 selectedDate 过滤）”，就传 allEvents
          events={allEvents}
          // ❗️如果你还在用旧版 CalendarView（不做内部过滤），改成：
          // events={eventsForSelectedDay}

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
