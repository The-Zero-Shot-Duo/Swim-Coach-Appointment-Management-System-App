// components/CalendarView.tsx

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { LessonEvent } from "../lib/types";

type Props = {
  events: LessonEvent[];
  // ✅ 放宽类型：我们会在 selected 日上加 selected/selectedColor
  markedDates: Record<string, any>;
  selectedDate: string; // "YYYY-MM-DD"
  onDayPress: (day: DateData) => void;
  onEventClick: (event: LessonEvent) => void;
};

// ✅ 安全时间转换：兼容 Firestore Timestamp / string / Date
const toDate = (v: any): Date =>
  v?.toDate ? v.toDate() : v instanceof Date ? v : new Date(v);

// ✅ 生成 "YYYY-MM-DD"（按本地时区校正，避免跨区导致日期偏移）
const toYMD = (v: any) => {
  const d = toDate(v);
  const isoLocal = new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  ).toISOString();
  return isoLocal.slice(0, 10);
};

export default function CalendarView({
  events,
  markedDates,
  selectedDate,
  onDayPress,
  onEventClick,
}: Props) {
  // ✅ 只渲染所选日期的事件
  const dayEvents = useMemo(
    () => events.filter((e) => toYMD((e as any).start) === selectedDate),
    [events, selectedDate]
  );

  const renderItem = useCallback(
    ({ item }: { item: LessonEvent }) => {
      const start = toDate((item as any).start);
      const end = toDate((item as any).end);
      const time = `${start.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })} - ${end.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;

      return (
        <TouchableOpacity
          style={styles.itemContainer}
          onPress={() => onEventClick(item)}
        >
          <Text style={styles.itemTitle}>
            {(item as any).title ?? "Lesson"}
          </Text>
          <Text>
            Student: {(item as any).extendedProps?.studentName ?? "N/A"}
          </Text>
          <Text style={styles.itemTime}>{time}</Text>
        </TouchableOpacity>
      );
    },
    [onEventClick]
  );

  return (
    <View style={styles.container}>
      <Calendar
        current={selectedDate}
        onDayPress={onDayPress}
        markedDates={{
          ...(markedDates ?? {}),
          [selectedDate]: {
            ...(markedDates?.[selectedDate] ?? {}), // ✅ 防御式展开，避免 undefined 报错
            selected: true,
            selectedColor: "deepskyblue",
          },
        }}
        enableSwipeMonths={true}
      />

      <FlatList
        // ✅ 只给当天数据
        data={dayEvents}
        renderItem={renderItem}
        keyExtractor={(item, idx) =>
          (item as any).id ?? `${toYMD((item as any).start)}-${idx}`
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No lessons scheduled for this day.
            </Text>
          </View>
        }
        contentContainerStyle={
          dayEvents.length === 0 ? styles.emptyListPadding : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  itemContainer: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 14,
    marginHorizontal: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  itemTitle: { fontWeight: "bold", fontSize: 16 },
  itemTime: { marginTop: 5, color: "#666" },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 16, color: "#888" },
  emptyListPadding: { flexGrow: 1, paddingTop: 50 },
});
