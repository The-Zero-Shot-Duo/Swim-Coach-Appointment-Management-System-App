// components/CalendarView.tsx

import React, { useMemo, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Agenda, AgendaEntry } from "react-native-calendars";
import { LessonEvent } from "../lib/types";

// 创建一个安全的、包含所有信息的日程条目类型
interface CustomAgendaEntry extends AgendaEntry, LessonEvent {}

interface AgendaItems {
  [date: string]: CustomAgendaEntry[];
}

type Props = {
  // prop 改回接收原始的 events 数组
  events: LessonEvent[];
  onEventClick: (event: LessonEvent) => void;
};

export default function CalendarView({ events = [], onEventClick }: Props) {
  const selectedDate = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  // 数据转换逻辑在这里，并使用 useMemo 保证稳定
  const agendaItems: AgendaItems = useMemo(() => {
    const items: AgendaItems = {};

    events.forEach((event) => {
      const dateKey = event.start.split("T")[0];
      if (!items[dateKey]) {
        items[dateKey] = [];
      }
      // 安全地创建 CustomAgendaEntry
      items[dateKey].push({
        ...event,
        name: event.extendedProps.studentName,
        height: 80,
        day: event.start,
      });
    });

    // 关键！如果最终的 items 对象是空的，为 "selectedDate" (今天) 添加一个空数组
    // 这可以规避 Agenda 组件在 items 为完全空对象时的 Bug
    if (Object.keys(items).length === 0) {
      items[selectedDate] = [];
    }

    return items;
  }, [events, selectedDate]); // 依赖于 events 和 selectedDate

  const renderItem = useCallback(
    (item: AgendaEntry) => {
      const lesson = item as LessonEvent;
      return (
        <TouchableOpacity
          style={styles.itemContainer}
          onPress={() => onEventClick(lesson)}
        >
          <Text style={styles.itemTitle}>{lesson.title}</Text>
          <Text>Student: {lesson.extendedProps.studentName}</Text>
          <Text style={styles.itemTime}>
            {new Date(lesson.start).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" - "}
            {new Date(lesson.end).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </TouchableOpacity>
      );
    },
    [onEventClick]
  ); // 使用 useCallback 稳定函数引用

  return (
    <Agenda
      items={agendaItems}
      renderItem={renderItem}
      selected={selectedDate}
      renderEmptyDate={() => (
        <View style={styles.emptyDate}>
          <Text>No lessons</Text>
        </View>
      )}
      theme={{
        agendaDayTextColor: "deepskyblue",
        agendaDayNumColor: "deepskyblue",
        agendaTodayColor: "deepskyblue",
        dotColor: "deepskyblue",
      }}
    />
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    backgroundColor: "white",
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
    marginTop: 17,
    minHeight: 80,
    justifyContent: "center",
  },
  itemTitle: {
    fontWeight: "bold",
    fontSize: 16,
  },
  itemTime: {
    marginTop: 5,
    color: "#666",
  },
  emptyDate: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 5,
    marginRight: 10,
    marginTop: 17,
  },
});
