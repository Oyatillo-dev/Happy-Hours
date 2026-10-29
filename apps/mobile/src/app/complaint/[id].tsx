import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { uploadPhoto, useComplaint } from '@/api/hooks';
import { Button } from '@/components/ui';
import { useI18n } from '@/i18n';
import { notice } from '@/lib/confirm';
import { colors, radius, space } from '@/theme';

/** FR-B10: complaint within 24 h after pickup, with an optional photo. */
export default function ComplaintScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, err } = useI18n();
  const complaint = useComplaint();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (camera: boolean) => {
    setError(null);
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError(t.complaint.cameraDenied);
    } else if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return setError(t.complaint.photoDenied);
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, exif: false };
    const res = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0]);
  };

  const submit = async () => {
    const body = text.trim();
    if (body.length < 5) return setError(t.complaint.tooShort);
    setError(null);
    try {
      let photoUrl: string | undefined;
      if (photo) {
        setUploading(true);
        photoUrl = await uploadPhoto(photo);
        setUploading(false);
      }
      await complaint.mutateAsync({ orderId: id, text: body, photoUrl });
      notice(t.order.complaintSent);
      router.back();
    } catch (e) {
      setUploading(false);
      setError(err(e));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>{t.complaint.hint}</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t.complaint.placeholder}
          placeholderTextColor={colors.faint}
          multiline
          maxLength={2000}
          style={styles.textArea}
          autoFocus
        />
        {photo ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
            <Pressable style={styles.remove} onPress={() => setPhoto(null)} accessibilityLabel={t.complaint.removePhoto}>
              <Ionicons name="close" size={18} color={colors.white} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.photoButtons}>
            {Platform.OS !== 'web' ? (
              <Button title={t.complaint.takePhoto} icon="camera-outline" variant="secondary" style={{ flex: 1 }} onPress={() => void pick(true)} />
            ) : null}
            <Button title={t.complaint.addPhoto} icon="image-outline" variant="secondary" style={{ flex: 1 }} onPress={() => void pick(false)} />
          </View>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {uploading ? <Text style={styles.hint}>{t.complaint.uploading}</Text> : null}
        <Button title={t.complaint.send} onPress={() => void submit()} loading={uploading || complaint.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md },
  hint: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  textArea: {
    minHeight: 140,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
  photoButtons: { flexDirection: 'row', gap: space.sm },
  photoWrap: { alignSelf: 'flex-start' },
  photo: { width: 160, height: 160, borderRadius: radius.md },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: colors.danger, fontSize: 14 },
});
