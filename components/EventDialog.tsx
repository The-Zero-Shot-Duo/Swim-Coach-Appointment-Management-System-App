// components/EventDialog.tsx
import React from "react";
import { Modal, Portal, Card, Text, Button } from "react-native-paper";
import { LessonEvent } from "../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  data: LessonEvent;
};

export default function EventDialog({ open, onClose, data }: Props) {
  const { extendedProps, start, end, title } = data;

  return (
    <Portal>
      <Modal
        visible={open}
        onDismiss={onClose}
        contentContainerStyle={{ padding: 20 }}
      >
        <Card>
          <Card.Title
            title={title || "Lesson Details"}
            titleVariant="headlineSmall"
          />
          <Card.Content>
            <Text variant="bodyLarge">
              <Text style={{ fontWeight: "bold" }}>Student:</Text>{" "}
              {extendedProps.studentName}
            </Text>
            <Text variant="bodyLarge">
              <Text style={{ fontWeight: "bold" }}>Course:</Text>{" "}
              {extendedProps.courseName}
            </Text>
            <Text variant="bodyLarge">
              <Text style={{ fontWeight: "bold" }}>Coach:</Text>{" "}
              {extendedProps.coachName}
            </Text>
            <Text variant="bodyLarge">
              <Text style={{ fontWeight: "bold" }}>Duration:</Text>{" "}
              {extendedProps.durationMin} min
            </Text>
            <Text variant="bodyLarge">
              <Text style={{ fontWeight: "bold" }}>Start:</Text>{" "}
              {new Date(start).toLocaleString()}
            </Text>
            <Text variant="bodyLarge">
              <Text style={{ fontWeight: "bold" }}>End:</Text>{" "}
              {new Date(end).toLocaleString()}
            </Text>
            {extendedProps.location && (
              <Text variant="bodyLarge">
                <Text style={{ fontWeight: "bold" }}>Location:</Text>{" "}
                {extendedProps.location}
              </Text>
            )}
            {extendedProps.notes && (
              <Text variant="bodyLarge">
                <Text style={{ fontWeight: "bold" }}>Notes:</Text>{" "}
                {extendedProps.notes}
              </Text>
            )}
          </Card.Content>
          <Card.Actions>
            <Button onPress={onClose}>Close</Button>
          </Card.Actions>
        </Card>
      </Modal>
    </Portal>
  );
}
