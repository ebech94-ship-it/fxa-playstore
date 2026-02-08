import { useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface PasswordInputProps extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: any; // allow passing custom styles
}

export default function PasswordInput({ value, onChangeText, placeholder, style, ...rest }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={[styles.input]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#aaa"
        secureTextEntry={!show}
        {...rest}
      />
      <TouchableOpacity onPress={() => setShow(!show)}>
        <Ionicons
          name={show ? "eye-off" : "eye"}
          size={22}
          color="#fff"
          style={{ paddingHorizontal: 6 }}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#5A4BE7",
    backgroundColor: "#1e1e1e",
    paddingHorizontal: 8,
  },
  input: {
    flex: 1,
    color: "white",
    padding: 12,
  },
});
