import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  Button,
  ActivityIndicator,
  Linking,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import React from "react";
import { Video, ResizeMode } from "expo-av";
import { ensureSignedIn, callGenerateLifeDemo } from "./src/firebaseClient";

export default function App() {
  const [loading, setLoading] = React.useState(false);
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const videoRef = React.useRef<Video | null>(null);

  const onGenerate = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setUrl(null);
    try {
      await ensureSignedIn();
      const signedUrl = await callGenerateLifeDemo();
      setUrl(signedUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {!url && (
        <>
          <Text style={styles.title}>Generate 9:16 Life Demo</Text>
          <Button
            title={loading ? "Processing…" : "Generate Video"}
            onPress={onGenerate}
            disabled={loading}
          />
        </>
      )}
      {loading && (
        <View style={{ alignItems: "center", marginTop: 16 }}>
          <ActivityIndicator />
          <Text style={styles.subtle}>This can take up to a minute…</Text>
        </View>
      )}

      {url && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preview</Text>
          <Video
            ref={videoRef}
            source={{ uri: url }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping
            shouldPlay
          />

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Linking.openURL(url)}
            >
              <Text style={styles.actionButtonText}>Download</Text>
            </TouchableOpacity>
          </View>

          <Text numberOfLines={2} style={styles.urlText}>
            {url}
          </Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f6f7f9",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 16,
  },
  subtle: {
    marginTop: 8,
    color: "#6b7280",
    fontSize: 12,
  },
  card: {
    width: "100%",
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
  },
  video: {
    width: "100%",
    aspectRatio: 9 / 16,
    backgroundColor: "#000",
    borderRadius: 8,
    overflow: "hidden",
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  actionButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  urlText: {
    marginTop: 8,
    color: "#4b5563",
    fontSize: 12,
  },
  error: {
    marginTop: 16,
    color: "red",
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
