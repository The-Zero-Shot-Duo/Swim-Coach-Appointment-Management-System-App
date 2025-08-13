// components/CalendarView.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Agenda, AgendaEntry } from "react-native-calendars";
import { LessonEvent } from "../lib/types";

interface CustomAgendaEntry extends AgendaEntry, LessonEvent {}

interface AgendaItems {
  [date: string]: CustomAgendaEntry[];
}

type Props = {
  events: LessonEvent[];
  onEventClick: (event: LessonEvent) => void;
};

function lessonToAgendaEntry(event: LessonEvent): CustomAgendaEntry {
  return {
    ...event,
    name: event.extendedProps.studentName,
    height: 80,
    day: event.start,
  };
}

// ✅ 最终修复：为 events prop 设置一个默认值 []
// 这样即使父组件传来 undefined，它也会安全地使用一个空数组
export default function CalendarView({ events = [], onEventClick }: Props) {
  console.log("CalendarView is rendering with", events.length, "events.");

  const agendaItems: AgendaItems = useMemo(() => {
    const items: AgendaItems = {};
    events.forEach((event) => {
      const dateKey = event.start.split("T")[0];
      if (!items[dateKey]) {
        items[dateKey] = [];
      }
      items[dateKey].push(lessonToAgendaEntry(event));
    });
    return items;
  }, [events]);

  const selectedDate = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  const renderItem = (item: CustomAgendaEntry) => {
    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => onEventClick(item)}
      >
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text>Student: {item.extendedProps.studentName}</Text>
        <Text style={styles.itemTime}>
          {new Date(item.start).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" - "}
          {new Date(item.end).toLocaleTimeString([], {
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
      renderItem={renderItem as any}
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
