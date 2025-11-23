import { WebView } from "react-native-webview";
import { useLocalSearchParams } from "expo-router";

export default function WebViewCheckout() {
  const { url } = useLocalSearchParams();
  return <WebView source={{ uri: url }} />;
}
