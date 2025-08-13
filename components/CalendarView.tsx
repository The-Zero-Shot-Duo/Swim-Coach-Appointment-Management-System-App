// components/CalendarView.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Agenda, AgendaEntry } from "react-native-calendars";
import { LessonEvent } from "../lib/types";

// 定义 Agenda items 的数据结构
interface AgendaItems {
  [date: string]: AgendaEntry[];
}

type Props = {
  events: LessonEvent[];
  onEventClick: (event: LessonEvent) => void;
};

// 辅助函数：将 LessonEvent 转换为 AgendaEntry
function lessonToAgendaEntry(event: LessonEvent): AgendaEntry {
  return {
    ...event, // 保留原始数据
    name: event.extendedProps.studentName,
    height: 80,
    day: event.start,
  };
}

export default function CalendarView({ events, onEventClick }: Props) {
  // useMemo 用于优化性能，避免每次渲染都重新计算
  const agendaItems: AgendaItems = useMemo(() => {
    const items: AgendaItems = {};
    events.forEach((event) => {
      const dateKey = event.start.split("T")[0]; // e.g., "2025-08-14"
      if (!items[dateKey]) {
        items[dateKey] = [];
      }
      items[dateKey].push(lessonToAgendaEntry(event));
    });
    return items;
  }, [events]);

  // 自定义渲染每个日程项
  const renderItem = (item: AgendaEntry) => {
    const lesson = item as LessonEvent; // 类型转换回 LessonEvent
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
  };

  return (
    <Agenda
      items={agendaItems}
      renderItem={renderItem}
      // 今天的日期
      selected={new Date().toISOString().split("T")[0]}
      // 当某个日期没有事件时显示的内容
      renderEmptyDate={() => (
        <View style={styles.emptyDate}>
          <Text>No lessons</Text>
        </View>
      )}
      // Agenda 的主题，可以定制颜色等
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
