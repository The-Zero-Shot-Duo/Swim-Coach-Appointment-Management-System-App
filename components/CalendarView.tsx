// components/CalendarView.tsx

import React, { useCallback } from "react";
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
  markedDates: { [key: string]: { marked: true; dotColor: string } };
  selectedDate: string;
  onDayPress: (day: DateData) => void;
  onEventClick: (event: LessonEvent) => void;
};

export default function CalendarView({
  events,
  markedDates,
  selectedDate,
  onDayPress,
  onEventClick,
}: Props) {
  const renderItem = useCallback(
    ({ item }: { item: LessonEvent }) => {
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
    },
    [onEventClick]
  );

  return (
    <View style={styles.container}>
      <Calendar
        current={selectedDate}
        onDayPress={onDayPress}
        markedDates={{
          ...markedDates,
          [selectedDate]: {
            ...markedDates[selectedDate],
            selected: true,
            selectedColor: "deepskyblue",
          },
        }}
        enableSwipeMonths={true}
      />
      <FlatList
        data={events}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No lessons scheduled for this day.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  itemContainer: {
    backgroundColor: "white",
    borderRadius: 5,
    padding: 15,
    marginHorizontal: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  itemTitle: {
    fontWeight: "bold",
    fontSize: 16,
  },
  itemTime: {
    marginTop: 5,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: "#888",
  },
});
